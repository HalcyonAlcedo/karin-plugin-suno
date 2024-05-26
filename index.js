import path from 'path'
import fs from 'fs'
import { logger, common } from '#Karin'

/** 当前文件的绝对路径 */
const filePath = common.absPath(import.meta.url.replace(/^file:(\/\/\/|\/\/)/, ''))
/** 插件包的目录路径 */
const dirname = path.dirname(filePath)
/** 插件包的名称 */
const basename = path.basename(dirname)
/** 插件包相对路径 */
const dirPath = './plugins/' + basename

const _package = JSON.parse(fs.readFileSync(dirPath + '/package.json', 'utf8'))
/** 插件包的版本 */
const version = _package.version

export { dirPath }

logger.info(`${basename}插件 ${version} 初始化~`)
