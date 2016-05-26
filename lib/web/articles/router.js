var express = require('express');
var path = require('path');
var aws = require('aws-sdk');
var env = require('node-env-file');
env('.env')

var ERR_MAP = {
  'ArticleNotFound': 404,
  'ScrapeFailed': 500
};
const S3_BUCKET = process.env.S3_BUCKET

module.exports = function articlesRouter(app) {

  return new express.Router()
    .get('/', showForm)
    .get('/sign-s3.json', signS3)
    .get('/articles.json', listArticles)
    .get('/articles/:articleId.json', showArticle)
    .post('/articles.json', addArticle)
    .use(articleErrors)
    .use(express.static(path.join(__dirname, 'public')));

  function showForm(req, res, next) {
    res.render(path.join(__dirname, 'list'));
  }

  function listArticles(req, res, next) {
    app
      .listArticles(req.session.project, 15, req.query['fresh'])
      .then(sendList, next);

    function sendList(list) {
      res.json(list);
    }
  }

  function addArticle(req, res, next) {
    app
      .addArticle(req.session.project, req.body.url, req.body.title)
      .then(sendLink, next);

    function sendLink(id) {
      res.json({ link: '/articles/' + id + '.json' });
    }
  }

  function showArticle(req, res, next) {
    app
      .getArticle(req.params.articleId)
      .then(sendArticle, next);

    function sendArticle(article) {
      return res.json(article);
    }
  }
  
  function articleErrors(err, req, res, next) {
    var status = ERR_MAP[err.name];
    if (status) err.status = status;
    next(err);
  }

  function signS3(req, res, next){
    const s3 = new aws.S3();
    const fileName = req.query['file-name'];
    const fileType = req.query['file-type'];
    const s3Params = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Expires: 60,
      ContentType: fileType,
      ACL: 'public-read'
    };

    s3.getSignedUrl('putObject', s3Params, (err, data) => {
      if(err){
        return res.end();
      }
      const returnData = {
        signedRequest: data,
        url: `https://${S3_BUCKET}.s3.amazonaws.com/${fileName}`
      };
      res.json(returnData);
    });
  }
};
