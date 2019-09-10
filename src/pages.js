const path = require('path')

export const createWagtailPages = (pageMap, args, fragmentFiles = []) => {
    const  { graphql, actions, cache } = args
    const { createPage, touchNode } = actions
    return graphql(`
        {
            wagtail {
                pages {
                    contentType
                    url
                    slug
                    id
                }
            }
        }
    `).then(res => {
        const pages = res.data.wagtail.pages
        if (pages) {
            
            // Create preview page and pass page-map.
            createPage({
                path: '/preview',
                component: path.resolve('./node_modules/gatsby-source-wagtail/preview-template.js'),
                context: { pageMap, fragmentFiles },
            })

            // Create pages for any page objects that match the page map.
            return pages.map(page => {
                const pageCacheKey = `page-${page.id}`
                cache.get(pageCacheKey).then(pageHash => {
                    
                    if (pageHash && pageHash == page.fileHash) {
                        const node = getNodes().find(node => node.url == url)
                        touchNode({ nodeId: node.id })
                        return;
                    } else {
                        cache.set(pageCacheKey, page.hash)
                    }
    
                    const matchingKey = Object
                        .keys(pageMap)
                        .find(key => key.toLowerCase() == page.contentType.toLowerCase())
                    
                    if (matchingKey) {
                        const template = pageMap[matchingKey]
                        createPage({
                            path: page.url,
                            component: path.resolve('./src/' + template),
                            context: page,
                        })                    
                    }
                })
            })
        }
    })
}