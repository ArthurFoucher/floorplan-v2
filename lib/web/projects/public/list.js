function ProjectVM(data){
  this.name = data.name;
  this.id = data._id
}

function ProjectListVM() {
  this.projects = ko.observableArray();
  this.projectname = ko.observable();
}
  
ProjectListVM.prototype.fetch = function(fresh) {
  $.getJSON('/projects.json', function(projects) {
    this.projects(projects.map(function(project) {
      return new ProjectVM(project);
    }));
  }.bind(this));
};

var vm = new ProjectListVM();
ko.applyBindings(vm);
vm.fetch();



