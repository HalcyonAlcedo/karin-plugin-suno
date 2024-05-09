import { plugin, segment } from '#Karin'
import Cfg from '../lib/config.js'
import generateRandomStyle from '../suno/style.js'
import SunoClient from '../suno/sunoClient.js'
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
          cron: '*/5 * * * * *',
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
    const getInfo = (strings) => {
      return strings.map(str => {
        const titleMatch = str.match(/标题[:：]?\s*([^风格歌词]+?)[\s\n]*风格|$/)
        const styleMatch = str.match(/风格[:：]?\s*([^歌词]+?)[\s\n]*歌词|$/)
        const lyricsMatch = str.match(/歌词[:：]?\s*(.+?)\s*$/)
        // 将风格字符串分割为数组，使用中英文分号、换行、空格作为分隔符
        const styles = styleMatch ? styleMatch[1].trim().split(/[:：;\n\s]+/) : []
        return {
          title: titleMatch ? titleMatch[1].trim() : '',
          styles: styles,
          lyrics: lyricsMatch ? lyricsMatch[1].trim() : ''
        }
      })
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
      sunoInfo.title = e.sender.nick ? `${e.sender.nick}之歌` : '新的歌曲'
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
    const client = new SunoClient({ api: Cfg.api })
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
      this.reply('歌曲生成中', { at: false, recallMsg: 0, reply: true, button: false })
    }
    console.log(e)
  }

  async getMusic() {
    if (this.sunoList.length > 0) {
      const client = new SunoClient({ api: Cfg.api })
      for (let i in this.sunoList) {
        const data = await client.getAudioInformation(this.sunoList[i].ids)
        let msg =[]
        for (let info of data) {
          if (info.status === 'complete') {
            // 从队列移除
            if (Cfg.video) {
              msg.push(segment.video(info.video_url))
            } else {
              msg.push(segment.record(info.audio_url))
            }
            if (Cfg.share) {
              msg.push(segment.share('https://suno.com/song/' + info.id, info.title, `风格 ${info.tags}`, info.image_url))
            }
            this.sunoList[i].send = true
          }
        }
        if (this.sunoList[i].send) {
          await this.sunoList[i].reply(msg)
          this.sunoList.splice(i, 1)
        }
      }
    }
  }

}
