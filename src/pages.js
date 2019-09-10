const path = require('path')

export const createWagtailPages = (pageMap, args, fragmentFiles = []) => {
    const  { graphql, actions, cache } = args
    const { createPage, touchNode } = actions
    return graphql(`
        {
            wagtail {
                pages {
                    ...on Story {
                        contentType
                        url
                        slug
                        id
                        lastPublishedAt
                    }
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
                if (!page.lastPublishedAt)
                    return

                const pageCacheKey = `page-${page.id}`
                cache.get(pageCacheKey).then(pageHash => {
                
                    if (pageHash && page.lastPublishedAt == pageHash) {
                        console.log(`USING CACHED PAGE: ${page.url}`)
                        return;
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