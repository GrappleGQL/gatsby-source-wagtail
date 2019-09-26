const path = require('path')
const flatCache = require('flat-cache')
const pageRecords = flatCache.load('gatsby-source-wagtail')

export const createWagtailPages = async (pageMap, args, fragmentFiles) => {
    console.log(pageRecords.all())
    const { cache, actions, graphql } = args
    const { createPage } = actions
    const res = await graphql(`
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
    `)
    if (res.data.wagtail.pages) {
        const pages = res.data.wagtail.pages
        
        // Create pages for any page objects that match the page-map.
        pages.map(async page => {
            const matchingKey = Object.keys(pageMap)
                .find(key => key.toLowerCase() == page.contentType.toLowerCase())
            
            const pageCacheKey = `page-${page.id}`
            const cacheResult = await pageRecords.getKey(pageCacheKey)
            if (cacheResult) {
                console.log('Using Cache: ', pageCacheKey)
            }

            if (matchingKey) {
                const template = pageMap[matchingKey]
                pageRecords.setKey(pageCacheKey, page)
                pageRecords.save(true)
                createPage({
                    path: page.url,
                    component: path.resolve('./src/' + template),
                    context: page,
                })      
            }
        })

        // Create preview page and pass page-map.
        createPage({
            path: '/preview',
            component: path.resolve('./node_modules/gatsby-source-wagtail/preview-template.js'),
            context: { pageMap, fragmentFiles },
        })

    } else {
        console.log("Could not read any Wagtail Pages from query!")
    }
}