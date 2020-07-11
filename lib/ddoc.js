/* global emit */

module.exports = {
  _id: '_design/queries',
  views: {
    props: {
      map: function (doc) {
        var keys = Object.keys(doc)
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i]
          var value = doc[key]
          if (value === true) {
            emit(key)
          }
        }
      }.toString(),
      reduce: '_count'
    },
    propByTime: {
      map: function (doc) {
        if (!doc.item) { return }
        var { created_at: createdAt, published } = doc.item
        var postDate = createdAt || published
        if (!postDate) { return }
        var keys = Object.keys(doc)
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i]
          var value = doc[key]
          if (value !== true) { continue } // not _id, etc; just flag props
          emit([key, postDate])
        }
      }.toString()
    },
    byAccount: {
      map: function (doc) {
        if (doc.item.account) {
          emit([doc.item.account.url, doc.item.created_at])
        }
      }.toString()
    }
  }
}
