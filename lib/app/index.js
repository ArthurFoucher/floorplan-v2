var logger = require('logfmt');
var Promise = require('promise');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;

var connections = require('./connections');
var ArticleModel = require('./article-model');
var ProjectModel = require('./project-model');

var SCRAPE_QUEUE = 'jobs.scrape';

function App(config) {
  EventEmitter.call(this);

  this.config = config;
  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

module.exports = function createApp(config) {
  return new App(config);
};

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.onConnected = function() {
  var queues = 0;
  this.Article = ArticleModel(this.connections.db, this.config.mongo_cache);
  this.Project = ProjectModel(this.connections.db, this.config.mongo_cache);
  this.connections.queue.create(SCRAPE_QUEUE, { prefetch: 5 }, onCreate.bind(this));

  function onCreate() {
    if (++queues === 1) this.onReady();
  }
};

App.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

App.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

App.prototype.addArticle = function(userId, url, title) {
  var id = uuid.v1();
  this.connections.queue.publish(SCRAPE_QUEUE, { id: id, url: url, userId: userId, title: title });
  return Promise.resolve(id);
};

App.prototype.scrapeArticle = function(userId, id, url, title) {
  return this.Article.scrape(userId, id, url, title);
};

App.prototype.purgePendingArticles = function() {
  logger.log({ type: 'info', msg: 'app.purgePendingArticles' });

  return new Promise(function(resolve, reject) {
    this.connections.queue.purge(SCRAPE_QUEUE, onPurge);

    function onPurge(err, count) {
      if (err) return reject(err);
      resolve(count);
    }
  }.bind(this));
};

App.prototype.getArticle = function(id) {
  return this.Article.get(id);
};

App.prototype.listArticles = function(userId, n, fresh) {
  return this.Article.list(userId, n, fresh);
};

App.prototype.startScraping = function() {
  this.connections.queue.handle(SCRAPE_QUEUE, this.handleScrapeJob.bind(this));
  return this;
};

App.prototype.handleScrapeJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'handling job', queue: SCRAPE_QUEUE, url: job.url });

  this
    .scrapeArticle(job.userId, job.id, job.url, job.title)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', status: 'success', url: job.url });
    ack();
  }

  function onError(err) {
    console.log(err)
    logger.log({ type: 'info', msg: 'job complete', status: 'failure', url: job.url });
    ack();
  }
};


App.prototype.stopScraping = function() {
  this.connections.queue.ignore(SCRAPE_QUEUE);
  return this;
};

App.prototype.deleteAllArticles = function() {
  logger.log({ type: 'info', msg: 'app.deleteAllArticles' });
  return this.Article.deleteAll();
};

App.prototype.addProject = function(projectname) {
  var id = uuid.v1();
  return this.Project.create(id, projectname)
  
};