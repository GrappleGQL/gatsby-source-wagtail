import React from "react"
import {
  decodePreviewUrl,
  withPreview
} from "./preview"

const PreviewPage = props => {
    const { pageMap, fragmentFiles } = props.pageContext
    let components = {}
    if (pageMap) {
        
        // Import all fragment files and extract string
        let fragments = ''
        if (fragmentFiles) {
            fragmentFiles.map(file => {
                const module = require(`../../${file.slice(2)}`)
                Object.keys(module).map(exportKey => {
                    const exportObj = module[exportKey]
                    if (typeof exportObj.source == 'string') {
                        fragments += exportObj.source
                    }
                })
            })
        }
        console.log(fragments)

        Object.keys(pageMap).map(contentType => {
            const componentFile = require(`../../${pageMap[contentType].slice(2)}`)
            components[contentType.toLowerCase()] = withPreview(
                componentFile.default, 
                componentFile.query,
                fragments
            )
        })
       
        const { content_type } = decodePreviewUrl()
        if (content_type) {
            const Component = components[content_type.toLowerCase()]
            if (Component) {
                return <Component />
            }
        }
        return null
    } 
    return null
}

export default PreviewPage
