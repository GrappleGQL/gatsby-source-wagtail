import React from 'react'
import qs from "querystring";
import { cloneDeep, merge } from "lodash";
import { createClient, createRequest, dedupExchange, fetchExchange } from 'urql';
import { print } from "graphql/language/printer"
import { pipe, subscribe } from 'wonka'

import { getQuery, getIsolatedQuery } from './index'
import introspectionQueryResultData from './fragmentTypes.json'


const generatePreviewQuery = (query, contentType, token, subscribe = false) => {
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
    query: queryDef,
    subscriptionQuery
  }
};

export const decodePreviewUrl = () => {
  if (typeof window !== "undefined") {
    return qs.parse(window.location.search.slice(1));
  }
  return {}
};

const PreviewProvider = (query, fragments = '', onNext) => {
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

  // Create urql client
  const client = createClient({
    url,
    fragments: getQuery(fragments),
    exchanges: [
      dedupExchange,
      fetchExchange,
    ],
  })

  if (content_type && token) {
    // Generate query from exported one in component
    const { query, subscriptionQuery } = generatePreviewQuery(
      isolatedQuery,
      content_type,
      token
    );

    // Get first version of preview to render the template
    const previewRequest = createRequest(query)
    pipe(
      client.executeQuery(previewRequest),
      subscribe(({ data, error }) => {
        console.log(data, error);
        onNext(data)
      })
    )
  }
};

export const withPreview = (WrappedComponent, pageQuery, fragments = '') => {
  // ...and returns another component...
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        wagtail: cloneDeep((props.data) ? props.data.wagtail : {})
      };
      PreviewProvider(pageQuery, fragments, res => {
        this.setState({
          wagtail: merge({}, this.state.wagtail, res.data)
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

export default withPreview
