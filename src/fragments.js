import { graphql } from 'graphql'

export const imageFragments = graphql`
    fragment WagtailImageSharpFixed on ImageObjectType {
        base64
        width
        height
        src
        srcSet(sizes: [100, 200, 400, 800])
    }

    fragment WagtailImageSharpFixed_tracedSVG on ImageObjectType {
        width
        height
        src
        srcSet(sizes: [100, 200, 400, 800])
        tracedSVG
    }

    fragment WagtailImageSharpFixed_noBase64 on ImageObjectType {
        width
        height
        src
        srcSet(sizes: [100, 200, 400, 800])
    }

    fragment WagtailImageSharpFluid on ImageObjectType {
        base64
        aspectRatio
        src
        srcSet(sizes: [100, 200, 400, 800])
        sizes
    }

    fragment WagtailImageSharpFluid_tracedSVG on ImageObjectType {
        tracedSVG
        aspectRatio
        src
        srcSet(sizes: [100, 200, 400, 800])
        sizes
    }

    fragment WagtailImageSharpFluid_noBase64 on ImageObjectType {
        aspectRatio
        src
        srcSet(sizes: [100, 200, 400, 800])
        sizes
    }
`