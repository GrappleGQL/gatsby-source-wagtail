const uuidv4 = require(`uuid/v4`)
const {
    buildSchema,
    printSchema,
    graphqlSync,
    introspectionQuery,
    IntrospectionQuery
} = require(`graphql`)
const { fromIntrospectionQuery } = require('graphql-2-json-schema')

const {
    makeRemoteExecutableSchema,
    delegateToSchema,
    transformSchema,
    introspectSchema,
    RenameTypes,
    mergeSchemas
} = require(`graphql-tools`)
const { createHttpLink } = require(`apollo-link-http`)
const fetch = require(`node-fetch`)
const invariant = require(`invariant`)
const traverse = require(`traverse`)

const {
    NamespaceUnderFieldTransform,
    StripNonQueryTransform
} = require(`gatsby-source-graphql/transforms`)

const { createSelection } = require(`./utils`)

exports.sourceNodes = async (
    { actions, createNodeId, cache, createContentDigest },
    options
) => {
    const { addThirdPartySchema, createNode } = actions
    const {
        url,
        typeName,
        fieldName,
        headers = {},
        fetchOptions = {},
        createLink,
        createSchema,
        refetchInterval
    } = options

    invariant(
        typeName && typeName.length > 0,
        `gatsby-source-wagtail requires option \`typeName\` to be specified`
    )
    invariant(
        fieldName && fieldName.length > 0,
        `gatsby-source-wagtail requires option \`fieldName\` to be specified`
    )
    invariant(
        (url && url.length > 0) || createLink,
        `gatsby-source-wagtail requires either option \`url\` or \`createLink\` callback`
    )

    let link
    if (createLink) {
        link = await createLink(options)
    } else {
        link = createHttpLink({
            uri: url,
            fetch,
            headers,
            fetchOptions
        })
    }

    let introspectionSchema

    if (createSchema) {
        introspectionSchema = await createSchema(options)
    } else {
        const cacheKey = `gatsby-source-wagtail-${typeName}-${fieldName}`
        let sdl = await cache.get(cacheKey)

        // Cache the remote schema for performance benefit
        if (!sdl) {
            introspectionSchema = await introspectSchema(link)
            sdl = printSchema(introspectionSchema)
        } else {
            introspectionSchema = buildSchema(sdl)
        }

        await cache.set(cacheKey, sdl)
    }

    // Create a remote link to the Wagtail GraphQL schema
    const remoteSchema = makeRemoteExecutableSchema({
        schema: introspectionSchema,
        link
    })

    // Create a point in the schema that can be used to access Wagtail
    const nodeId = createNodeId(`gatsby-source-wagtail-${typeName}`)
    const node = createSchemaNode({
        id: nodeId,
        typeName,
        fieldName,
        createContentDigest
    })
    createNode(node)

    const resolver = (parent, args, context) => {
        context.nodeModel.createPageDependency({
            path: context.path,
            nodeId: nodeId
        })
        return {}
    }

    // Add some customization of the remote schema
    let transforms = []
    if (options.prefixTypename) {
        transforms = [
            new StripNonQueryTransform(),
            new RenameTypes(name => `${typeName}_${name}`),
            new NamespaceUnderFieldTransform({
                typeName,
                fieldName,
                resolver
            }),
            new WagtailRequestTransformer()
        ]
    } else {
        transforms = [
            new StripNonQueryTransform(),
            new NamespaceUnderFieldTransform({
                typeName,
                fieldName,
                resolver
            }),
            new WagtailRequestTransformer()
        ]
    }

    const mergeLocalAndRemoteSchema = async () => {
        // merge the schema along with custom resolvers
        const schema = mergeSchemas({
            schemas: [remoteSchema]
        })

        // Apply any transforms
        return transformSchema(schema, transforms)
    }

    // Add new merged schema to Gatsby
    addThirdPartySchema({
        schema: await mergeLocalAndRemoteSchema()
    })

    // Allow refreshing of the remote data in DEV mode only
    if (process.env.NODE_ENV !== `production`) {
        if (refetchInterval) {
            const msRefetchInterval = refetchInterval * 1000
            const refetcher = () => {
                createNode(
                    createSchemaNode({
                        id: nodeId,
                        typeName,
                        fieldName,
                        createContentDigest
                    })
                )
                setTimeout(refetcher, msRefetchInterval)
            }
            setTimeout(refetcher, msRefetchInterval)
        }
    }
}

function createSchemaNode({ id, typeName, fieldName, createContentDigest }) {
    const nodeContent = uuidv4()
    const nodeContentDigest = createContentDigest(nodeContent)
    return {
        id,
        typeName: typeName,
        fieldName: fieldName,
        parent: null,
        children: [],
        internal: {
            type: `GraphQLSource`,
            contentDigest: nodeContentDigest,
            ignoreType: true
        }
    }
}

class WagtailRequestTransformer {
    transformSchema = schema => schema
    transformRequest = request => {
        for (let node of traverse(request.document.definitions).nodes()) {
            if (
                node?.kind == 'Field' &&
                node?.selectionSet?.selections?.find(
                    selection => selection?.name?.value == 'imageFile'
                )
            ) {
                // Add field to AST
                const createSelection = name => ({
                    kind: 'Field',
                    name: {
                        kind: 'Name',
                        value: name
                    },
                    arguments: [],
                    directives: []
                })
                // Make sure we have src, height & width details
                node.selectionSet.selections.push(createSelection('id'))
                node.selectionSet.selections.push(createSelection('src'))
                // Break as we don't need to visit any other nodes
                break
            }
        }

        return request
    }
    transformResult = result => result
}
