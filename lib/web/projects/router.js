var uuid = require('node-uuid');
var express = require('express');
var path = require('path');

module.exports = function articlesRouter(app) {

  return new express.Router()
    .get('/projects.json', listProjects)
    .get('/projects/clear', clearProject)
    .get('/', showForm)
    .post('/projects.json', createProject)
    .get('/projects/:projectId', accessProject)
    .use(express.static(path.join(__dirname, 'public')));

  function showForm(req, res, next) {
    if (req.session.project) {
      next();
    }else{
      res.render(path.join(__dirname, 'list')); 
    }
  }

  function listProjects(req, res, next) {
    app
      .getProjects()
      .then(displayProjects, next);

    function displayProjects(projects){
      res.json(projects);
    }
  }

  function createProject(req, res, next){
    app
      .addProject(req.body.projectname)
      .then(sendLink, next);

    function sendLink(project){
      req.session.project = project._id
      res.redirect('/');
    }
  }
  function accessProject(req, res, next){
    req.session.project = req.params.projectId
    res.redirect('/');
  }
  function clearProject(req, res, next){
    req.session.project = false;
    res.redirect('/');
  }
};
