function ArticleVM(data) {
  this.large = data.large;
  this.thumb = data.thumb;
  this.title = data.title;
  this.type = data.type;
  this.show = data.type !== 'pdf';
  this.original = data.original;
}

function ArticleListVM() {
  this.articles = ko.observableArray();
  this.url = ko.observable();
  this.pending = ko.observable();
  this.title = ko.observable();
  this.fakepath = ko.observable();
  this.file = ko.observable();
  this.error = ko.observable(null);
  this.pollInterval = null;
  this.polls = 0;
  
  this.initUpload = function() {
    const files = document.getElementById('file-input').files;
    const file = files[0];
    if(file == null){
      return alert('No file selected.');
    }
    this.file(file.name)
    getSignedRequest(file);
  }

  this.addArticle = function() {
    if (this.pending()) return;
    var spliturl = this.file().split('.');
    var type = spliturl.pop();
    if (!this.title()) {
      this.title(spliturl.join('.'))
    };
    data = {
          large: [],
          thumb: [],
          type: type,
          title: this.title(),
          original: this.url()
        }
        vm.articles.unshift(new ArticleVM(data))
        vm.error('generating thumb and large png')
    $.post('/articles.json', { url: this.url(), title: this.title() }, onCreate.bind(this));
  }.bind(this);

  this.isPending = ko.computed(function() {
    return !!this.pending();
  }, this);

  this.isPending.subscribe(function(pending) {
    clearInterval(this.pollInterval);
    if (pending) {
      this.polls = 0;
      this.pollInterval = setInterval(poll.bind(this), 3000);
    }
  }, this);

  function onCreate(created) {
    this.pending(created.link);
  }

  function poll() {
    if (this.polls++ > 10) {
      this.pending(null);
      this.error('Unable to fetch that url');
      return;
    }

    $.ajax({
      dataType: 'json',
      url: this.pending(),
      success: onSuccess.bind(this)
    });

    function onSuccess(data) {
      if (!data) return;
      this.pending(null)
      this.error(null);
      this.fetch(true);
      this.url('');
      this.title(null);
      this.fakepath(null);
    }
  }
}

ArticleListVM.prototype.fetch = function(fresh) {
  $.getJSON('/articles.json', { fresh: fresh }, function(articles) {
    this.articles(articles.map(function(article) {
      return new ArticleVM(article);
    }));
  }.bind(this));
};

var vm = new ArticleListVM();
ko.applyBindings(vm);
vm.fetch();

function uploadFile(file, signedRequest, url){
  vm.error('uploading to S3')
  const xhr = new XMLHttpRequest();
  xhr.open('PUT', signedRequest);
  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200){
        vm.url(url);
        vm.addArticle()
      }
      else{
        alert('Could not upload file.');
      }
    }
  };
  xhr.send(file);
}

/*
  Function to get the temporary signed request from the app.
  If request successful, continue to upload the file using this signed
  request.
*/
function getSignedRequest(file){
  vm.error('fetching upload url from S3')
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/sign-s3.json?file-name=${file.name}&file-type=${file.type}`);
  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200){
        const response = JSON.parse(xhr.responseText);
        uploadFile(file, response.signedRequest, response.url);
      }
      else{
        alert('Could not get signed URL.');
      }
    }
  };
  xhr.send();
}



