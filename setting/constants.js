
constants = ( function() {
  var BASE = {
    "DIR": "/Apache24/htdocs/wu_wei2/",
    "LOCATION": "https%3A%2F%2Fwww.sambuichi.jp%2Fwu_wei2%2F",
    "INDEX_URL": "/wu_wei2/index.html"
  };

  var AWS_ENV = {
    "region": "ap-northeast-1",
    "identityPoolId": 'ap-northeast-1:edb80ba3-ea19-487a-bee0-30a1d0a54c64',
    "userPoolId": 'ap-northeast-1_GT1UVlcyM',
    "clientId": '3vt0usscse5cvqk0sc6ud4bc4n',
    "bucketName": 'contents.wuwei',
    "application": 'WuWei',
    "delimiter": '/',
    "identityId": null,
    "username": null,
    "prefix": null
  };

  var BLOG_ENV = {
    "baseUrl": 'https://www.wuwei.space/blog/wp-json/',
    "rest_api": {
      "wuwei": 'wuwei/v1',
      "jwt_auth": 'jwt-auth/v1',
      "acf": 'acf/v3',
      "wp": 'wp/v2'
    }
  };

  // var RADIUS = 50;
  var FORCE = {
    "SIMULATE": true,
    "TRANSPARENT": {
      "EXPIRE": true,
      "TIMEOUT": 60000,
      "MAX_TOUCH": 5,
      "FACTOR": 0.6
    },
    "LINK": {
      "DISTANCE": 384,
      "ITERATIONS": 1
    },
    "CHARGE": {
      "STRENGTH": -384,
      "DISTANCE": {
        "MIN": 256,
        "MAX": 512
      }
    },
    "COLLIDE" : {
      "STRENGTH": 1,
      "RADIUS": 256,
      "ITERATIONS": 1
    },
    "ALPHA_TARGET": 0,
    "VELOCITY_DECAY": 0.4,
    "ALPHA_DECAY": 0.0228
  };

  var GOOGLE_ENV = {
    "API_ROOT": {
      'YouTube': 'https://www.googleapis.com/youtube/v3'
    },
    "API_KEY": {
      'YouTube': 'AIzaSyCNgSFOXM2Qi4wkWeO-ICYnzuS11DkY56I'
    },
    'CLIENT_ID': '721378528283-214fnbqbbgkn1ad1phcjeiu63atd3sg5'
  };

  var CONF = {
    "host": window.location.origin || window.location.protocol + '//' + window.location.host,
    "assetsUrl": (window.location.origin || window.location.protocol + '//' + window.location.host) + '/assets/',
    "blogUrl": (window.location.origin || window.location.protocol + '//' + window.location.host) + '/pc295/',
    "mailTo": 'mailto:admin@wuwei.spcae'
  };

  return {
    BASE: BASE,
    AWS_ENV : AWS_ENV,
    BLOG_ENV: BLOG_ENV,
    FORCE: FORCE,
    GOOGLE_ENV: GOOGLE_ENV,
    CONF: CONF
  };
}());

