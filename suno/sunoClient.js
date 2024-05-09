import axios from 'axios'

export default class SunoClient {
    constructor(props) {
        this.props = props
    }

    async generateMusic(config) {
        if (!config?.mode) {
            return false
        }
        if (config.mode == 'tags' && config.tags) {
            return await generateAudioByPrompt({
                prompt: config.tags,
                make_instrumental: false,
                wait_audio: false,
            })
        }
        if (config.mode == 'customize') {
            if (!config.title || !config.styles || !config.lyrics) {
                return false
            }
            return await customGenerateAudio({
                prompt: config.lyrics,
                tags: config.styles,
                title: config.title,
                make_instrumental: false,
                wait_audio: false
            })
        }
    }

    async customGenerateAudio(payload) {
        const url = `${this.props.api}/api/custom_generate`
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        })
        return response.data
    }
    async generateAudioByPrompt(payload) {
        const url = `${this.props.api}/api/generate`
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        })
        return response.data
    }
    async extendAudio(payload) {
        const url = `${this.props.api}/api/extend_audio`
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        })
        return response.data
    }
    async getAudioInformation(audioIds) {
        const url = `${this.props.api}/api/get?ids=${audioIds}`
        const response = await axios.get(url)
        return response.data
    }
    async getQuotaInformation() {
        const url = `${this.props.api}/api/get_limit`
        const response = await axios.get(url)
        return response.data
    }

}
