import { Bot, plugin, segment, redis } from '#Karin'
import Cfg from '../lib/config.js'
import generateRandomStyle from '../suno/style.js'
import SunoClient from '../suno/sunoClient.js'
import { KarinContact } from '../../../lib/bot/KarinElement.js'

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
          log: true
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
    // 提示词生成模式
    if (!sunoInfo.title && !sunoInfo.lyrics) {
      sunConfig = {
        mode: 'tags',
        tags: command
      }
    }
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
        tags: sunoInfo.title
      }
    }
    if (sunConfig.mode == 'customize' && !sunoInfo.styles) {
      // 生成随机风格
      sunConfig.styles = generateRandomStyle()
    }
    const client = new SunoClient({ api: Cfg.Config.api })
    const sunoMusics = await client.generateMusic(sunConfig)
    if (sunoMusics[0].id) {
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
      this.reply('歌曲生成中', { at: false, recallMsg: 0, reply: true, button: false })
    }
  }

  async getMusic() {
    let sunoList = await redis.keys('Suno-*')
    if (sunoList.length > 0) {
      const client = new SunoClient({ api: Cfg.Config.api })
      for (let k of sunoList) {
        let sunoData = JSON.parse(await redis.get(k))
        logger.info(`获取歌曲${sunoData.config.title ? '《' + sunoData.config.title + '》' : ''}信息 ${sunoData.ids}`)
        const data = await client.getAudioInformation(sunoData.ids)
        let msg = []
        for (let info of data) {
          if (info.status === 'complete') {
            // 如果多次发送失败则发送链接
            if(Cfg.Config.video) {
              if (sunoData.retry < 5) {
                msg.push(segment.video(info.video_url))
              } else {
                msg.push(segment.text(`歌曲 《${info.title}》 \n风格 ${info.tags} \n https://suno.com/song/${info.id}`))
              }
            } else {
              msg.push(segment.text(`歌曲 《${info.title}》 \n风格 ${info.tags} \n https://suno.com/song/${info.id}`))
            }
            logger.info(`《${info.title}》(${info.id}) 歌曲生成完成`)
          } else {
            logger.info(`《${info.title}》(${info.id}) 歌曲生成中`)
          }
        }
        if (msg.length > 0) {
          let bot = Bot.adapter[parseInt(sunoData.bot)]
          // 发送消息
          try {
            if (sunoData.isGroup) {
                await bot.SendMessage(KarinContact.group(parseInt(sunoData.contact.peer)), msg)
            } else {
                await bot.SendMessage(KarinContact.private(parseInt(sunoData.contact.peer)), msg)
            }
            await redis.del(k)
          } catch (error) {
            logger.error(error.toString())
            sunoData.retry = (sunoData.retry || 0) + 1
            if (sunoData.retry > 5) {
              await redis.del(k)
            } else {
              await redis.set(`Suno-${sunoData.ids}`, JSON.stringify(sunoData), { EX: 120 })
            }
          }
        }
      }
    }
  }

}
