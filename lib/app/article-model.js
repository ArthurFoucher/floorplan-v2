var mongoose = require('mongoose');
var cache = require('mongoose-cache');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var summarize = require('summarize');
var superagent = require('superagent');
var _ = require('lodash');
var async = require('async');
var im = require('imagemagick');
var fs = require('fs');

var AWS = require('aws-sdk');
var env = require('node-env-file');
env('.env')

var errors = require('./errors');

var STATES = ['pending', 'complete', 'failed'];
var FIVE_MINUTES = 1000 * 60 * 5;

module.exports = function createArticleModel(connection, maxAge) {

  // Monkey-patch Mongoose to support in-memory caching for 10s
  cache.install(mongoose, {
    max: 50,
    maxAge: maxAge
  });

  var Schema = mongoose.Schema({
    _id: { type: String },
    projectId: { type: String },
    title: { type: String },
    type: { type: String },
    original: { type: String },
    large: { type: [ String ], default: [ ] },
    thumb: { type: [ String ], default: [ ] }
  }, {
    strict: true
  });

  Schema.plugin(timestamps);

  Schema.statics = {

    scrape: function(projectId, id, url, title) {
      return new Promise(function(resolve, reject) {
        var Article = this;

        var s3 = new AWS.S3();
        var key = url.split('/').pop();
        var params = {Bucket: 'buck-heroku-t', Key: key};

        var ext = url.split('.').pop();
        var dir = 'temp/' + id + '/';

        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        var path = dir + id + '.' + ext;
        var file = require('fs').createWriteStream(path);
        var stream = s3.getObject(params).createReadStream().pipe(file);

        stream.on('finish', onResponse);

        function onResponse() {
          async.parallel([
            processImage.bind({dir:dir, size:'large', path: path, id: id}),
            processImage.bind({dir:dir, size:'thumb', path: path, id: id})
          ],
          function(err, results){
            new Article({ 
              _id: id, 
              projectId: projectId,
              title: title, 
              type: ext, 
              original: url, 
              large: results[0], 
              thumb: results[1] 
            }).save(onSave);    
          });
        }

        function processImage(callback){
          var size = this.size;
          var dir = this.dir + '/' + this.size + '/';
          if (!fs.existsSync(dir)){
              fs.mkdirSync(dir);
          }

          imgsize = (this.size == 'thumb') ? '100x100' : '2000x2000';
          im.convert([this.path, '-resize', imgsize, dir + this.id + '.png'], function(err, stdout){
            if (err) {
              return reject(err);
            };
            fs.readdir(dir, function(err, files){
              if (err) {
                return reject(err);
              }
              async.map(files, save.bind({dir: dir, size: '-'+ size +'.'}), function(err, results){
                callback(null, results);
              });
            })
          });
        }

        function save(file, callback){
          var body = fs.createReadStream(this.dir +file);
          var fileSplit = file.split('.');
          var ext = fileSplit.pop();
          var filename = fileSplit.pop() + this.size + ext;
          var params = {Bucket: 'buck-heroku-t', Key: filename, ACL: 'public-read'};
          var s3obj = new AWS.S3({params: params});
          s3obj.upload({Body: body}).
            send(function(err, data){
              if (err) {
                  return reject(err);
              }
              fs.unlinkSync(this.dir + file)
              callback(null, data.Location);
          }.bind({dir: this.dir}))
        }

        function onSave(err, article) {
          if (err) {
            logger.log({ type: 'error', msg: 'could not save', url: url, error: err });
            return reject(err);
          }
          logger.log({ type: 'info', msg: 'saved article', id: article.id, url: article.url, title: article.title });
          return resolve(article);
        }

      }.bind(this));
    },

    get: function(id) {
      return new Promise(function(resolve, reject) {
        this.findById(id).exec(function(err, article) {
          if (err) return reject(err);
          if (!article) return reject(new errors.ArticleNotFound());
          resolve(article);
        });
      }.bind(this));
    },

    list: function(projectId, n, fresh) {
      return new Promise(function(resolve, reject) {
        this.find({ 
          projectId: { 
            $eq: projectId
          }
        }).sort('-createdAt')
          .limit(n || 50)
          .cache(!fresh)
          .exec(onArticles);

        function onArticles(err, articles) {
          if (err) return reject(err);
          resolve(articles);
        }
      }.bind(this));
    },

    deleteAll: function() {
      return new Promise(function(resolve, reject) {
        this.remove().exec(function(err) {
          if (err) return reject(err);
          resolve();
        });
      }.bind(this));
    }
  };


  var Article = connection.model('Article', Schema);
  return Article;
};
