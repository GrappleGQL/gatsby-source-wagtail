import React from 'react';

exports.onRenderBody = ({ setHeadComponents }, pluginOptions) => {
  const { 
    typeName,
    fieldName,
    isDefault,
    url, 
    websocketUrl = null, 
    headers 
  } = pluginOptions;

  const connectionName = isDefault
    ? 'default'
    : fieldName

  setHeadComponents([
    <script
      key={`plugin-wagtail-${typeName}`}
      dangerouslySetInnerHTML={{
        __html: `window.___wagtail = window.___wagtail || {}; window.___wagtail["${connectionName}"] = ${JSON.stringify({ typeName, fieldName, url, headers, websocketUrl })}; `
      }}
    />
  ]);
}