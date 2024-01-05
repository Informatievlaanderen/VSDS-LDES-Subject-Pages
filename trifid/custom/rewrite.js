import camouflageRewrite from 'camouflage-rewrite'

/**
 * Rewrite the dataset base URL.
 *
 * Configuration fields:
 *  - datasetBaseUrl (string): the base URL to rewrite
 *  - rewriteContent (boolean): rewrite response content
 *
 * Other available options are documented here: https://github.com/zazuko/camouflage-rewrite#usage
 *
 * @param {import('../types/index.d.ts').TrifidMiddlewareArgument} trifid Trifid object containing the configuration, and other utility functions.
 * @returns {Promise<import('../types/index.d.ts').ExpressMiddleware>} Express middleware.
 */
const factory = (trifid) => {
    const { config } = trifid
    const { rewriteContent, datasetBaseUrl } = config

    let rewriteContentValue = true
    if (rewriteContent !== undefined) {
        rewriteContentValue = rewriteContent
    }

    // skip rewriting if the `datasetBaseUrl` is empty
    if (!datasetBaseUrl) {
        return (_req, _res, next) => {
            next()
        }
    }

    const rewrite = camouflageRewrite({
        ...config,
        url: datasetBaseUrl,
        rewriteContent: rewriteContentValue,
    })



    return (req, res, next) => {
        req.iri = req.iri.replaceAll(decodeURI(req.originalUrl), decodeURIComponent(req.originalUrl))
        req.originalUrl = decodeURIComponent(req.originalUrl)
        req.url = decodeURIComponent(req.url)
        rewrite(req, res, next)
    }
}

export default factory
