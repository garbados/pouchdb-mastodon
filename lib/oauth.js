const bent = require('bent')

module.exports = {
  auth: async function (domain, name, scopes = 'read') {
    const request = bent(`https://${domain}/api/v1/`, 'POST', 'json')
    const item = await request('apps', {
      client_name: name,
      redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
      scopes
    })
    if (item.error) {
      const error = new Error(item.error_description)
      error.code = item.error
      throw error
    }
    const oauthUrl = [
      `https://${domain}/oauth/authorize`,
      '?response_type=code',
      `&client_id=${item.client_id}`,
      '&redirect_uri=urn:ietf:wg:oauth:2.0:oob',
      `&scope=${encodeURIComponent(scopes)}`
    ].join('')
    // save client id, secret
    await this.update({ _id: `${domain}/oauth/auth`, oauth: true, item })
    // then pass the oauthUrl to get the access code
    return oauthUrl
  },
  access: async function (domain, code, scope = 'read') {
    try {
      await this.get(`${domain}/oauth/access`)
      // already authorized
      return null
    } catch (error) {
      if (error.message !== 'missing') {
        throw error
      }
    }
    let auth
    try {
      const { item } = await this.get(`${domain}/oauth/auth`)
      auth = item
    } catch (error) {
      if (error.message === 'missing') {
        throw new Error('Must run `.auth` first.')
      } else {
        throw error
      }
    }
    const request = bent(`https://${domain}/`, 'POST', 'json')
    const item = await request('oauth/token', {
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      client_id: auth.client_id,
      client_secret: auth.client_secret,
      scope
    })
    if (item.error) {
      const error = new Error(item.error_description)
      error.code = item.error
      throw error
    } else {
      await this.update({ _id: `${domain}/oauth/access`, oauth: true, item })
    }
  }
}
