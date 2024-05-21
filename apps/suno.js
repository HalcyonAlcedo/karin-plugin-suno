import { Bot, plugin, segment, redis } from '#Karin'
import Cfg from '../lib/config.js'
import generateRandomStyle from '../suno/style.js'
import SunoClient from '../suno/sunoClient.js'
import { KarinContact } from '../../../lib/bot/KarinElement.js'
import axios from 'axios'

export class hello extends plugin {
  constructor() {
    super({
      // 必选 插件名称
      name: 'suno',
      // 插件描述
      dsc: '调用Suno-API生成歌曲',
      // 监听消息事件 默认message
      event: 'message',
      // 优先级
      priority: 5000,
      // 以下rule、task、button、handler均为可选，如键入，则必须为数组
      rule: [
        {
          /** 命令正则匹配 */
          reg: '^#(suno|Suno|唱歌)',
          /** 执行方法 */
          fnc: 'suno',
          //  是否显示操作日志 true=是 false=否
          log: true,
          // 权限 master,owner,admin,all
          permission: 'all'
        }
      ],
      task: [
        {
          // 必选 定时任务名称
          name: '获取suno歌曲',
          // 必选 cron表达式
          cron: '*/15 * * * * *',
          // 必选 方法名
          fnc: 'getMusic',
          // 是否显示操作日志 true=是 false=否
          log: false
        }
      ]
    })
  }

  sunoList = []

  async suno() {
    const msg = this.e.msg
    const command = msg.replace(/^#(suno|Suno|唱歌)/, '')
    const getInfo = (str) => {
      const titleMatch = str.match(/标题[:：]?\s*([^风格歌词]+?)(?=[风格歌词]|$)/)
      const styleMatch = str.match(/风格[:：]?\s*([^歌词]+?)(?=[歌词]|$)/)
      const lyricsMatch = str.match(/歌词[:：]?\s*([\s\S]+)/)
      const title = titleMatch ? titleMatch[1].trim() : ''
      const styles = styleMatch ? styleMatch[1].trim().split(/[:：;\n\s]+/).filter(Boolean).join(',') : ''
      const lyrics = lyricsMatch ? lyricsMatch[1].trim() : ''
      return {
        title,
        styles,
        lyrics
      }
    }

    let sunoInfo = getInfo(command)
    let sunConfig = sunoInfo
    if (!sunoInfo.title) {
      // 提示词生成模式
      sunConfig = {
        mode: 'tags',
        tags: command
      }
    } else {
      // 自定义生成模式
      sunConfig.mode = 'customize'
      if (!sunoInfo.title) {
        // 无标题时以用户昵称作为标题
        sunoInfo.title = this.e.sender.nick ? `${this.e.sender.nick}之歌` : '新的歌曲'
      }
      if (!sunoInfo.lyrics) {
        // 如果没有歌词则降级为提示词生成模式
        sunConfig = {
          mode: 'tags',
          tags: command
        }
      }
    }
    if (sunConfig.mode == 'customize' && !sunoInfo.styles) {
      // 生成随机风格
      sunConfig.styles = generateRandomStyle()
    }
    const client = new SunoClient({ api: Cfg.Config.api })
    const sunoMusics = await client.generateMusic(sunConfig)
    if (sunoMusics && sunoMusics[0].id) {
      let ids = []
      for (let data of sunoMusics) {
        ids.push(data.id)
      }
      this.sunoList.push({
        ids: ids.join(','),
        config: sunConfig,
        isGroup: this.e.isGroup,
        sender: this.e.sender,
        reply: this.e.reply
      })
      await redis.set(`Suno-${ids.join(',')}`, JSON.stringify({
        ids: ids.join(','),
        config: sunConfig,
        bot: this.e.self_id,
        isGroup: this.e.isGroup,
        contact: this.e.contact,
        sender: this.e.sender
      }), { EX: 120 })

      logger.info(`开始生成歌曲 ${ids.join(',')}`)
      this.reply('歌曲生成中', { reply: true, recallMsg: 8 })
    } else {
      this.reply('歌曲生成失败', { reply: true, recallMsg: 8 })
    }
  }

  sendVideoMsg(data, maxRetries =5, attempt = 0) {
    Bot.sendMsg(
      data.bot,
      data.isGroup ? KarinContact.group(data.peer) : KarinContact.private(data.peer),
      segment.video(data.url)
    ).catch((error) => {
      if (attempt < maxRetries) {
        attempt++
        logger.warn(`视频发送失败，正在进行第${attempt}次重试...`)
        setTimeout(() => this.sendVideoMsg(data, maxRetries, attempt), 5000)
      } else {
        logger.error(`视频发送失败`)
      }
    })
  }

  async getMusic() {
    let sunoList = await redis.keys('Suno-*')
    if (sunoList.length > 0) {
      const client = new SunoClient({ api: Cfg.Config.api })
      for (let k of sunoList) {
        let sunoData = JSON.parse(await redis.get(k))
        logger.info(`获取歌曲${sunoData.config.title ? '《' + sunoData.config.title + '》' : ''}信息 ${sunoData.ids}`)
        const data = await client.getAudioInformation(sunoData.ids)
        for (let info of data) {
          if (info.status === 'complete') {
            // 发送消息
            if (Cfg.Config.text) {
              Bot.sendMsg(
                parseInt(sunoData.bot),
                sunoData.isGroup ? KarinContact.group(parseInt(sunoData.contact.peer)) : KarinContact.private(parseInt(sunoData.contact.peer)),
                `歌曲 《${info.title}》 \n风格 ${info.tags} \n https://suno.com/song/${info.id}`
              )
            }
            // 发送音频
            if (Cfg.Config.audio) {
              axios.post(`${Cfg.Config.media}/audio`, {
                recordUrl: info.audio_url
              }).then((audioData) => {
                const audioBuffer = Buffer.from(audioData.data.buffer.data)
                Bot.sendMsg(
                  parseInt(sunoData.bot),
                  sunoData.isGroup ? KarinContact.group(parseInt(sunoData.contact.peer)) : KarinContact.private(parseInt(sunoData.contact.peer)),
                  segment.record(`base64://${audioBuffer.toString('base64')}`)
                )
              }).catch(() => {
                Bot.sendMsg(
                  parseInt(sunoData.bot),
                  sunoData.isGroup ? KarinContact.group(parseInt(sunoData.contact.peer)) : KarinContact.private(parseInt(sunoData.contact.peer)),
                  '音频获取失败'
                )
              })
            }
            // 发送视频
            if (Cfg.Config.video) {
              this.sendVideoMsg({
                bot: parseInt(sunoData.bot),
                peer: parseInt(data.peer),
                url: info.video_url
              })
            }
            redis.del(k)
            logger.info(`《${info.title}》(${info.id}) 歌曲生成完成`)
          } else {
            logger.info(`《${info.title}》(${info.id}) 歌曲生成中`)
          }
        }
      }
    }
  }

}
