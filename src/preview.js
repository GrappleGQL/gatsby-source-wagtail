import React from 'react'
import qs from "querystring";
import { cloneDeep, merge } from "lodash";
import { createClient, createRequest, dedupExchange, fetchExchange, subscriptionExchange } from 'urql'
import { cacheExchange } from '@urql/exchange-graphcache'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { createHttpLink } from 'apollo-link-http'
import { introspectSchema, makeRemoteExecutableSchema, mergeSchemas } from 'graphql-tools'
import { schemaExchange } from 'urql-exchange-schema'
import { print } from "graphql/language/printer"
import { pipe, subscribe } from 'wonka'
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

  // Create a remote link to the Wagtail GraphQL schema
  const introspectionSchema = await introspectSchema(link)
  const remoteSchema = makeRemoteExecutableSchema({
    schema: introspectionSchema,
    link,
  })

  // Mock the fieldName for accessing local image files
  const customTypes = `
    extend type CustomImage {
      localFile: File
    }

    type File {
      size: Int!
    }
  `

  const schemaExtensionResolvers = {
    CustomImage: {
      localFile: (parent, args, context, info) => {
        return {
          size: 0
        }
      }
    }
  }

  const schema = mergeSchemas({
    schemas: [remoteSchema, customTypes],
    resolvers: schemaExtensionResolvers
  })


  // Create urql client
  const client = createClient({
    url,
    exchanges: [
      schemaExchange(schema),
      dedupExchange,
      fetchExchange,
      subscriptionExchange({
        forwardSubscription: operation => subscriptionClient.request(operation)
      })
    ],
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
    const previewRequest = createRequest(query)
    pipe(
      client.executeQuery(previewRequest),
      subscribe(({ data, error }) => onNext(data))
    )

    // If setup then run sunscription
    if (websocketUrl) {
      const subscriptionRequest = createRequest(subscriptionQuery)
      pipe(
        client.executeSubscription(subscriptionRequest),
        subscribe(({ data, error }) => onNext(data))
      )
    }
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
