const fs = require('fs-extra')
const request = require('graphql-request')
const { createRemoteFileNode } = require('gatsby-source-filesystem')
const { sourceNodes } = require('./graphql-nodes')
const { getRootQuery } = require('./getRootQuery')
const { generateImageFragments } = require('./fragments')
const fetch = require(`node-fetch`)

const queryBackend = (query, url, headers) =>
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
            variables: {},
            query
        })
    }).then(result => result.json())

// Monkeypatch options to allow default fieldName and typeName
exports.onPreInit = ({}, options) => {
    options.fieldName = options.fieldName || 'wagtail'
    options.typeName = options.typeName || 'wagtail'
}

exports.sourceNodes = sourceNodes

exports.onCreateWebpackConfig = ({ stage, actions, getConfig }) => {
    const config = getConfig()
    if (stage.indexOf('html') >= 0) {
        return
    }

    const replaceRule = ruleUse => {
        if (
            ruleUse.loader &&
            ruleUse.loader.indexOf(`gatsby/dist/utils/babel-loader.js`) >= 0
        ) {
            ruleUse.loader = require.resolve(
                `gatsby-source-wagtail/babel-loader.js`
            )
        }
    }

    const traverseRule = rule => {
        if (rule.oneOf && Array.isArray(rule.oneOf)) {
            rule.oneOf.forEach(traverseRule)
        }

        if (rule.use) {
            if (Array.isArray(rule.use)) {
                rule.use.forEach(replaceRule)
            } else {
                replaceRule(rule.use)
            }
        }
    }
    config.module.rules.forEach(traverseRule)
    actions.replaceWebpackConfig(config)
}

exports.onPreExtractQueries = async ({ store, actions }, options) => {
    const { createRedirect } = actions
    return queryBackend(
        `{
    imageType
    redirects {
      oldPath
      newUrl
      isPermanent
    }
    __schema {
      types {
        kind
        name
        fields {
          name
        }
        possibleTypes {
          name
        }
      }
    }
  }`,
        options.url,
        options.headers
    ).then(({ data }) => {
        // Check if fields added by wagtail-gatsby are visible
        const wagtailGatsbyInstalled = !!data.__schema.types
            .find(objectType => objectType.name == data.imageType)
            .fields.find(field => field.name == 'tracedSVG')

        // Build schema file for Apollo, here we're filtering out any type information unrelated to unions or interfaces
        const filteredData = data.__schema.types.filter(
            type => type.possibleTypes !== null
        )
        data.__schema.types = filteredData
        fs.writeFile(
            './node_modules/gatsby-source-wagtail/fragmentTypes.json',
            JSON.stringify(data),
            err => {
                if (err) {
                    console.error(
                        'Gatsby-source-wagtail: Error writing fragmentTypes file',
                        err
                    )
                }
            }
        )

        // Generate Image Fragments for the servers respective image model.
        const program = store.getState().program
        const fragments = wagtailGatsbyInstalled
            ? generateImageFragments(data.imageType)
            : ''
        fs.writeFile(
            `${program.directory}/.cache/fragments/gatsby-source-wagtail-fragments.js`,
            fragments,
            err => {
                if (err) console.error(err)
            }
        )

        // Copy the boilerplate file and replace the placeholder with actual modal name
        fs.readFile(
            './node_modules/gatsby-source-wagtail/preview.boilerplate.js',
            (err, fileData) => {
                if (err)
                    return console.error(
                        'Could not read preview boilerplate file',
                        err
                    )
                // Replace placeholder
                let jsFile = fileData
                    .toString()
                    .replace('CustomImage', data.imageType)
                // Rewrite file so it's accessible
                fs.writeFile(
                    `./node_modules/gatsby-source-wagtail/preview.js`,
                    jsFile,
                    err => {
                        if (err)
                            console.error('Could not write preview file', err)
                    }
                )
            }
        )

        // Generate redirects for Netlify, controlled by Wagtail Admin.
        data.redirects.map(redirect =>
            createRedirect({
                fromPath: redirect.oldPath,
                toPath: redirect.newUrl,
                isPermanent: redirect.isPermanent,
                force: true
            })
        )
    })
}

exports.createResolvers = (
    { actions, getCache, createNodeId, createResolvers, store, reporter },
    options
) => {
    const { createNode } = actions
    return queryBackend(
        `{
    imageType
  }`,
        options.url,
        options.headers
    ).then(({ data }) => {
        createResolvers({
            [data.imageType]: {
                imageFile: {
                    type: `File`,
                    resolve(source, args, context, info) {
                        return createRemoteFileNode({
                            url: source.src,
                            store,
                            getCache,
                            createNode,
                            createNodeId
                        }).catch(err => console.error(err))
                    }
                }
            }
        })
    })
}
