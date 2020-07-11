const isEqual = require('lodash.isequal')

module.exports = {
  // force-update a document
  update: async function (doc) {
    try {
      const { _rev: rev, ...oldDoc } = await this.get(doc._id)
      if (doc._rev === rev) {
        await this.put(doc)
      } else if (isEqual(oldDoc, doc)) {
        // no update necessary
      } else {
        doc._rev = rev
        await this.put(doc)
      }
    } catch (error) {
      if (error.message === 'missing') {
        await this.put(doc)
      } else {
        throw error
      }
    }
  },
  // combine document attributes, overwriting old with new
  merge: async function (doc) {
    try {
      await this.put(doc)
    } catch (error) {
      if (error.name === 'conflict') {
        const oldDoc = await this.get(doc._id)
        const newDoc = { ...oldDoc, ...doc }
        await this.put(newDoc)
      } else {
        throw error
      }
    }
  },
  // delete a document even without a rev
  purge: async function (doc) {
    try {
      const knownDoc = await this.get(doc._id || doc)
      await this.remove(knownDoc)
    } catch (error) {
      if (error.name !== 'missing') {
        // ok if already gone
        throw error
      }
    }
  }
}
