import React from 'react'
import qs from "querystring"
import { cloneDeep, merge } from "lodash"
import traverse from 'traverse'

import { ApolloClient } from 'apollo-client'
import { gql } from "apollo-boost"
import { InMemoryCache } from 'apollo-cache-inmemory'
import { HttpLink } from 'apollo-link-http'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { createHttpLink } from 'apollo-link-http'
import { introspectSchema, makeRemoteExecutableSchema, mergeSchemas } from 'graphql-tools'

import { print } from "graphql/language/printer"
import { getQuery, getIsolatedQuery } from './index'
import introspectionQueryResultData from './fragmentTypes.json'


const PreviewProvider = async (query, fragments = '', onNext) => {
  // Extract query from wagtail schema
  const {
    typeName,
    fieldName,
    url,
    websocketUrl,
    headers
  } = window.___wagtail.default
  const isolatedQuery = getIsolatedQuery(query, fieldName, typeName);
  const { content_type, token } = decodePreviewUrl();

  // Generate auth token for basic auth.
  const getToken = () => {
    const username = process.env.GATSBY_AUTH_USER
    const password = process.env.GATSBY_AUTH_PASS
    return btoa(username + ':' + password)
  }

  // If provided create a subscription endpoint
  let subscriptionClient
  if (websocketUrl) {
    subscriptionClient = new SubscriptionClient(
      websocketUrl,
      {
        reconnect: true,
        connectionParams: {
          authToken: getToken()
        }
      }
    );
  }

  // Experimental cache to support node image processing
  const link = createHttpLink({
    uri: url,
    fetchOptions: {
      headers: { "Authorization": token ? `Basic ${getToken()}` : '' }
    },
  })

  // Mock the fieldName for accessing local image files
  const typeDefs = gql`
    type File {
      sourceInstanceName: String!
      absolutePath: String!
      relativePath: String!
      size: Int!
      prettySize: String!
      modifiedTime: Date!
      accessTime: Date!
      changeTime: Date!
      root: String!
      dir: String!
      base: String!
      ext: String!
      name: String!
      extension: String!
      relativeDirectory: String!
      url: String
      publicUrl: String
      childImageSharp: ImageSharp
      id: ID!
      parent: Node
      children: [Node!]!
    }

    type Node {
      id: ID!
    }

    type ImageSharp {
      fluid: ImageSharpFluid!
      fixed: ImageSharpFixed!
    }

    type ImageSharpFluid {
      base64: String
      tracedSVG: String
      aspectRatio: Float!
      src: String!
      srcSet: String!
      srcWebp: String
      srcSetWebp: String
      sizes: String!
      originalImg: String
      originalName: String
      presentationWidth: Int!
      presentationHeight: Int!
    }

    type ImageSharpFixed {
      base64: String
      tracedSVG: String
      aspectRatio: Float
      width: Float!
      height: Float!
      src: String!
      srcSet: String!
      srcWebp: String
      srcSetWebp: String
      originalName: String
    }

    type ImageSharpOriginal {
      height: Int!
      width: Int!
      src: String!
    }
  `

  const computeSharpSize = (source, info) => {
    let imageHeight = source.height
    let imageWidth = source.width
    let aspectRatio = imageWidth / imageHeight

    // Convert arguments to set of overrides
    let imageParams = {}
    for (let argument of info.field.arguments) {
      imageParams[argument.name?.value] = argument.value?.value
    }

    console.log(imageParams)

    // Allow resizing in the browser
    if (imageParams.height && imageParams.width) {
      imageHeight = imageParams.height
      imageWidth = imageParams.width
      aspectRatio = imageWidth / imageHeight
    }
    // If one is set
    else if (imageParams.height) {
      imageHeight = imageParams.height
      imageWidth = imageParams.height * aspectRatio
    }
    else if (imageParams.width) {
      imageHeight = imageParams.width / aspectRatio
      imageWidth = imageParams.width
    }

    return {
      imageHeight: Number(imageHeight),
      imageWidth: Number(imageWidth),
      aspectRatio
    }
  }

  const schemaExtensionResolvers = {
    ImageSharp: {
      fixed: (root, args, context, info) => {
        const source = root.fixed.parent
        const {
          imageWidth,
          imageHeight,
          aspectRatio
        } = computeSharpSize(source, info)

        return {
          __typename: "ImageSharpFixed",
          base64: "",
          tracedSVG: "",
          aspectRatio,
          width: imageWidth,
          height: imageHeight,
          src: source.src,
          srcSet: "",
          srcWebp: "",
          srcSetWebp: "",
          originalName: ""
        }
      },
      fluid: () => (root, args, context, info) => {
        const source = root.fluid.parent
        console.log(source, info)
        const {
          imageWidth,
          imageHeight,
          aspectRatio
        } = computeSharpSize(source, info)

        return {
          __typename: "ImageSharpFluid",
          base64: "",
          tracedSVG: "",
          aspectRatio,
          src: source.src,
          srcSet: "",
          srcWebp: null,
          srcSetWebp: null,
          sizes: "",
          originalImg: source.src,
          originalName: "",
          presentationWidth: source.width,
          presentationHeight: source.height
        }
      },
    },
    CustomImage: {
      imageFile: (source, args, context, info) => {
        // Create a fake date
        let fileCreatedAt = new Date();
        let fileCreatedAtISO = fileCreatedAt.toISOString();
        let fileCreatedAtStamp = fileCreatedAt.getTime() / 1000; // Return a fake file instance

        return {
          "__typename": "File",
          "sourceInstanceName": "__PROGRAMMATIC__",
          "relativePath": source.src,
          "absolutePath": source.src,
          "changeTime": fileCreatedAtISO,
          "size": 0,
          "prettySize": "0 kB",
          "accessTime": fileCreatedAtISO,
          "atime": fileCreatedAtISO,
          "atimeMs": fileCreatedAtStamp,
          "base": "Artboard.png",
          "birthTime": fileCreatedAtISO,
          "birthtimeMs": fileCreatedAtStamp,
          "ctime": fileCreatedAtISO,
          "ctimeMs": fileCreatedAtStamp,
          "dir": source.src,
          "ext": ".png",
          "extension": "png",
          // TODO:
          "id": source.id,
          "publicURL": source.src,
          // TODO:
          "relativeDirectory": source.src,
          // TODO:
          "root": source.src,
          // TODO:
          "uid": source.id,
          "url": source.src,
          "childImageSharp": {
            // TODO:
            __typename: "ImageSharp",
            fluid: {
              __typename: "ImageSharpFluid",
              parent: source
            },
            fixed: {
              __typename: "ImageSharpFixed",
              parent: source
            },
            original: {
              __typename: "ImageSharpOriginal",
              height: source.height,
              width: source.width,
              src: source.src
            }
          }
        }
      }
    }
  }

  // Create Apollo client
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
    typeDefs,
    resolvers: schemaExtensionResolvers
  })

  if (content_type && token) {
    // Generate query from exported one in component
    const { query, subscriptionQuery } = generatePreviewQuery(
      isolatedQuery,
      content_type,
      token,
      fragments
    );

    // Get first version of preview to render the template
    client
      .query({ query: gql([query]) })
      .then(result => onNext(result.data || {}))

    // If setup then run sunscription
    // if (websocketUrl) {
    //   const subscriptionRequest = createRequest(subscriptionQuery)
    //   pipe(
    //     client.executeSubscription(subscriptionRequest),
    //     subscribe(({ data, error }) => onNext(data))
    //   )
    // }
  }
};

export const withPreview = (WrappedComponent, pageQuery, fragments = '') => {
  // ...and returns another component...
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        wagtail: cloneDeep(
          (props.data)
            ? props.data.wagtail
            : {}
        )
      };
      PreviewProvider(pageQuery, fragments, data => {
        this.setState({
          wagtail: merge({}, this.state.wagtail, data)
        });
      });
    }

    render() {
      const data = merge({}, this.props.data, this.state);
      if (data.wagtail.page) {
        return <WrappedComponent {...this.props} data={data} />;
      } else {
        return null;
      }
    }
  };
};



const generatePreviewQuery = (query, contentType, token, fragments) => {
  // The preview args nessacery for preview backend to find the right model.
  query = cloneDeep(query);
  const previewArgs = [
    {
      kind: "Argument",
      name: {
        kind: "Name",
        value: "contentType"
      },
      value: {
        block: false,
        kind: "StringValue",
        value: contentType
      }
    },
    {
      kind: "Argument",
      name: {
        kind: "Name",
        value: "token"
      },
      value: {
        block: false,
        kind: "StringValue",
        value: token
      }
    }
  ];

  // Rename query for debugging reasons
  const queryDef = query.definitions[0];
  queryDef.arguments = []
  queryDef.variableDefinitions = []

  // Use for creating extra fields on a query
  const createSelection = name => ({
    "kind": "Field",
    "name": {
      "kind": "Name",
      "value": name,
    },
    "arguments": [],
    "directives": []
  })

  // Alter the query so that we can execute it properly
  for (let node of traverse(queryDef).nodes()) {
    // Get the node of any field attempting to download an image
    let imageFileNode = null
    if (node?.kind == "Field" && node
      ?.selectionSet
      ?.selections
      ?.find(selection => selection?.name?.value == "imageFile" && (imageFileNode = selection))) {

      // Make sure we have src, height & width details
      node.selectionSet.selections.push(createSelection('src'))
      node.selectionSet.selections.push(createSelection('width'))
      node.selectionSet.selections.push(createSelection('height'))

      // Make sure it hit's the client side cache
      imageFileNode.directives.push({
        arguments: [],
        kind: "Directive",
        name: {
          kind: "Name",
          value: "client"
        }
      })

      // Break as we don't need to visit any other nodes
      break
    }
  }

  if (queryDef.name) {
    queryDef.name.value = "Preview" + queryDef.name.value;
  } else {
    queryDef.name = {
      kind: "Name",
      value: "PreviewQuery"
    };
  }

  /*
    Iterate over fields on query and add preview args if it's a page.
    We store them as a var because if the query is a subscription we need to remove all
    non-page selections so we override the whole array with just the pages.
  */
  const pageSelections = queryDef.selectionSet.selections.filter(selection => {
    return selection.name.value.toLowerCase() === "page";
  });
  pageSelections.map(selection => (selection.arguments = previewArgs));

  // Change query to subcription type
  const subscriptionQuery = cloneDeep(queryDef)
  subscriptionQuery.operation = "subscription";
  subscriptionQuery.selectionSet.selections = pageSelections;

  return {
    query: `${fragments} ${print(query)}`,
    subscriptionQuery: `${fragments} ${print(subscriptionQuery)}`,
  }
};

export const decodePreviewUrl = () => {
  if (typeof window !== "undefined") {
    return qs.parse(window.location.search.slice(1));
  }
  return {}
};

export default withPreview
