import React from "react"
import {
  decodePreviewUrl,
  withPreview
} from "./preview"

const PreviewPage = props => {
    const { pageMap, fragmentFiles = [] } = props.pageContext
    let components = {}
    const isBrowser = typeof window != 'undefined'
    if (pageMap && isBrowser) {
        
        // Import all fragment files and extract string
        let fragments = ''
        import(`./fragments.js`).then(baseFragments => {
            if (baseFragments.wagtailFragments) {
                fragments += baseFragments.wagtailFragments
            }    
        })
        
        if (fragmentFiles.length) {
            fragmentFiles.map(async file => {
                const module = await import(`../../${file.slice(2)}`)
                Object.keys(module).map(exportKey => {
                    const exportObj = module[exportKey]
                    if (typeof exportObj.source == 'string') {
                        fragments += exportObj.source
                    }
                })
            })
        }

        Object.keys(pageMap).map(async contentType => {
            const componentFile = await import(`../../${pageMap[contentType].slice(2)}`)
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
