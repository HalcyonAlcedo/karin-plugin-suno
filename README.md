
# Suno 插件
---

## 安装插件

karin根目录执行以下命令安装Suno插件

```bash
git clone https://github.com/HalcyonAlcedo/karin-plugin-suno.git ./plugins/karin-plugin-suno
```

## 安装Suno-api

参考[Suno AI API](https://github.com/gcui-art/suno-api)进行安装

## 配置

修改Karin/plugins/karin-plugin-suno/config/config/config.yaml文件，将Suno-api添加到api中，例如api: http://127.0.0.1:3000

config.yaml文件会在首次运行后自动创建，也可以手动复制defSet中的config.yaml文件到config目录下然后修改

## 用法

### 提示词生成
发送 ```#唱歌 一首欢快的歌```

### 自定义生成
发送 ```#唱歌 标题 欢乐颂 风格 Christmas Carol 歌词 Come! Sing a song of joy for peace shall come, my brother```

缺少标题时将以发送人昵称为标题
缺少风格时将随机生成风格

## 相关链接
[Karin](https://github.com/KarinJS/Karin) 
[suno-api](https://github.com/gcui-art/suno-api) 
