var mongoose = require('mongoose');
var cache = require('mongoose-cache');
var timestamps = require('mongoose-timestamp');
var logger = require('logfmt');

var FIVE_MINUTES = 1000 * 60 * 5;

module.exports = function createProjectModel(connection, maxAge) {

  // Monkey-patch Mongoose to support in-memory caching for 10s
  cache.install(mongoose, {
    max: 50,
    maxAge: maxAge
  });

  var Schema = mongoose.Schema({
    _id: { type: String },
    name: { type: String }
  }, {
    strict: true
  });

  Schema.plugin(timestamps);

  Schema.statics = {

    create: function(id, projectname) {
      return new Promise(function(resolve, reject) {
        var Project = this;
        new Project({ 
            _id: id, 
            projectname: projectname
          }).save(onSave);

        function onSave(err, project) {
          if (err) {
            logger.log({ type: 'error', msg: 'could not save', url: url, error: err });
            return reject(err);
          }
          logger.log({ type: 'info', msg: 'saved project', id: project.id, url: project.projectname });
          return resolve(project);
        }

      }.bind(this));
    }
  }


  var Project = connection.model('Project', Schema);
  return Project;
};
