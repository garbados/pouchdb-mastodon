const bent = require('bent')
const ddoc = require('./ddoc')

module.exports = {
  setupMastodon: async function () {
    await this.update(ddoc)
  },
  _getAccessHeaders: async function (domain) {
    if (!this._accesses) this._accesses = {}
    let access = this._accesses[domain]
    if (!access) {
      try {
        const { item } = await this.get(`${domain}/oauth/access`)
        this._accesses[domain] = item
        access = item
      } catch (error) {
        if (error.message === 'missing') {
          throw new Error('Must run `.auth` first.')
        } else {
          throw error
        }
      }
    }
    const { item: { name } } = await this.get(`${domain}/oauth/auth`)
    const headers = {
      Accept: 'application/activity+json',
      'User-Agent': name,
      Authorization: `Bearer ${access.access_token}`
    }
    return headers
  },
  request: async function (domain, url, body = null, headers = {}) {
    let request
    if (url.indexOf('http') === 0) {
      request = bent(url, 200)
    } else {
      request = bent(`https://${domain}/api/v1/${url}`, 200)
    }
    const accessHeaders = await this._getAccessHeaders(domain)
    const response = await request('', body, { ...headers, ...accessHeaders })
    const result = { body: await response.json(), headers: response.headers }
    // get next page (since we start with the latest)
    if ('link' in headers) {
      const links = headers.link.split(',').map((linkRaw) => {
        return linkRaw.trim().match(/<(.+)>; rel="(\w+)"/).slice(1, 3)
      })
      const [next, prev] = ['next', 'prev'].map((direction) => {
        return links.filter(([link, rel]) => {
          return rel === direction
        }).map((link) => {
          return (typeof link === 'object') ? link[0] : link
        })[0]
      })
      if (next) { result.next = next }
      if (prev) { result.prev = prev }
    }
    return result
  },
  mastoPost: async function (domain, url, body, headers = {}) {
    let request
    if (url.indexOf('http') === 0) {
      request = bent(url, 'POST', 200)
    } else {
      request = bent(`https://${domain}/api/v1/${url}`, 'POST', 200)
    }
    const accessHeaders = await this._getAccessHeaders(domain)
    const response = await request('', body, { ...headers, ...accessHeaders })
    return { body: await response.json(), headers: response.headers }
  },
  postStatus: async function (domain, body) {
    const key = JSON.stringify(body)
    return this.mastoPost(domain, 'statuses', body, { 'Idempotency-Key': key })
  },
  getAccount: async function (domain) {
    try {
      const account = await this.get(`${domain}/account`)
      return account
    } catch {
      const { body: account } = await this.request(domain, 'accounts/verify_credentials')
      await this.update({ _id: `${domain}/account`, account: true, item: account })
      return this.getAccount(domain)
    }
  },
  downloadMastoCollection: async function (domain, path, ...args) {
    const { item: { acct } } = await this.getAccount(domain)
    const src = `${acct}@${domain}`
    const processPage = async (url) => {
      const result = await this.request(domain, url || path, ...args)
      for (let item of result.body) {
        if (typeof item === 'string') { item = { id: item } }
        const mergeItem = async () => {
          const doc = { _id: item.id, item, src }
          doc[path] = true
          await this.merge(doc)
        }
        try {
          const oldDoc = await this.get(item.id)
          if (oldDoc[path] !== true) {
            await mergeItem()
          } else {
            // doc is already up-to-date
          }
        } catch (error) {
          if (error.name === 'not_found') {
            await mergeItem()
          } else {
            throw error
          }
        }
      }
      if (result.next) { result.next = processPage.bind(this, result.next) }
      if (result.prev) { result.prev = processPage.bind(this, result.prev) }
      return result
    }
    return processPage()
  }
}
