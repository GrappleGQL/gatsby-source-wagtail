const path = require('path')
const flatCache = require('flat-cache')
const pageRecords = flatCache.load('gatsby-source-wagtail')

export const createWagtailPages = async (pageMap, args, fragmentFiles) => {
    const { cache, actions, graphql, getNodes } = args
    const { createPage } = actions
    const res = await graphql(`
        {
            wagtail {
                pages {
                    contentType
                    url
                    slug
                    id
                    lastPublishedAt
                }
            }
        }
    `)
    if (res.data.wagtail.pages) {
        // Pages from Wagtail
        const pages = res.data.wagtail.pages
        
        // Create pages for any page objects that match the page-map.
        await Promise.all(pages.map(async page => {
            const pageCacheKey = `cache-${page.url}`
            const matchingKey = Object.keys(pageMap)
                .find(key => key.toLowerCase() == page.contentType.toLowerCase())

            const localLastPublished = await pageRecords.getKey(pageCacheKey)
            if (localLastPublished == page.lastPublishedAt) {
                console.log('Using cached page: ', page.url)
                pageRecords.setKey(pageCacheKey, page.lastPublishedAt)
                pageRecords.save(true)
                return;
            }

            if (matchingKey) {
                const template = pageMap[matchingKey]
                pageRecords.setKey(pageCacheKey, page.lastPublishedAt)
                pageRecords.save(true)
                createPage({
                    path: page.url,
                    component: path.resolve('./src/' + template),
                    context: page,
                })
            }
        }))

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