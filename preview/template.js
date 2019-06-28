"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _index = require("./index");

var _jsxFileName = "/Users/nathanhorrigan/Code/gatsby-source-wagtail-grapple/src/preview/template.js";

const PreviewPage = props => {
  const {
    pageMap
  } = props.pageContext;
  let components = {};

  if (pageMap) {
    Object.keys(pageMap).map(contentType => {
      const componentFile = require(`../../${pageMap[contentType].slice(2)}`);

      components[contentType.toLowerCase()] = withPreview(componentFile.default, componentFile.query);
    });
    const {
      content_type
    } = (0, _index.decodePreviewUrl)();

    if (content_type) {
      const Component = components[content_type.toLowerCase()];

      if (Component) {
        return _react.default.createElement(Component, {
          __source: {
            fileName: _jsxFileName,
            lineNumber: 22
          },
          __self: void 0
        });
      }
    }

    return null;
  }

  return null;
};

var _default = PreviewPage;
exports.default = _default;