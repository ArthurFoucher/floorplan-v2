var uuid = require('node-uuid');
var express = require('express');
var path = require('path');

module.exports = function articlesRouter(app) {

  return new express.Router()
    .get('/', showForm)
    .get('/projects.json', listProjects)
    .post('/projects.json', createProject)
    .use(express.static(path.join(__dirname, 'public')));

  function showForm(req, res, next) {
    if (req.session.project) {
      next();
    }else{
      res.render(path.join(__dirname, 'list')); 
    }
  }

  function listProjects(req, res, next) {
    res.send('in lister');
  }

  function createProject(req, res, next){
    console.log(req.body)
    app
      .addProject(req.body.projectname)
      .then(sendLink, next);

    function sendLink(project){
      req.session.project = project._id
      res.send(req.session.project);
    }
  }
};
