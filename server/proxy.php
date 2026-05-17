<?PHP
// Script: Simple PHP Proxy: Get external HTML, JSON and more!
// *Version: 1.6, Last updated: 1/24/2009*
// Project Home - http://benalman.com/projects/php-simple-proxy/
// GitHub       - http://github.com/cowboy/php-simple-proxy/
// Source       - http://github.com/cowboy/php-simple-proxy/raw/master/ba-simple-proxy.php
//
// About: License
// Copyright (c) 2010 "Cowboy" Ben Alman,
// Dual licensed under the MIT and GPL licenses.
// http://benalman.com/about/license/
//
// About: Examples
// This working example, complete with fully commented code, illustrates one way
// in which this PHP script can be used.
//
// Simple - http://benalman.com/code/projects/php-simple-proxy/examples/simple/
//
// About: Release History
// 1.6 - (1/24/2009) Now defaults to JSON mode, which can now be changed to
//       native mode by specifying ?mode=native. Native and JSONP modes are
//       disabled by default because of possible XSS vulnerability issues, but
//       are configurable in the PHP script along with a url validation regex.
// 1.5 - (12/27/2009) Initial release
//
// Topic: GET Parameters
// Certain GET (query string) parameters may be passed into ba-simple-proxy.php
// to control its behavior, this is a list of these parameters.
//   url - The remote URL resource to fetch. Any GET parameters to be passed
//     through to the remote URL resource must be urlencoded in this parameter.
//   mode - If mode=native, the response will be sent using the same content
//     type and headers that the remote URL resource returned. If omitted, the
//     response will be JSON (or JSONP). <Native requests> and <JSONP requests>
//     are disabled by default, see <Configuration Options> for more information.
//   callback - If specified, the response JSON will be wrapped in this named
//     function call. This parameter and <JSONP requests> are disabled by
//     default, see <Configuration Options> for more information.
//   user_agent - This value will be sent to the remote URL request as the
//     `User-Agent:` HTTP request header. If omitted, the browser user agent
//     will be passed through.
//   send_cookies - If send_cookies=1, all cookies will be forwarded through to
//     the remote URL request.
//   send_session - If send_session=1 and send_cookies=1, the SID cookie will be
//     forwarded through to the remote URL request.
//   full_headers - If a JSON request and full_headers=1, the JSON response will
//     contain detailed header information.
//   full_status - If a JSON request and full_status=1, the JSON response will
//     contain detailed cURL status information, otherwise it will just contain
//     the `http_code` property.
//
// Topic: POST Parameters
// All POST parameters are automatically passed through to the remote URL
// request.
//
// Topic: JSON requests
// This request will return the contents of the specified url in JSON format.
//
// Request:
// > ba-simple-proxy.php?url=http://example.com/
//
// Response:
// > {"contents": "<html>...</html>", "headers": {...}, "status": {...} }
//
// JSON object properties:
//   contents - (String) The contents of the remote URL resource.
//   headers - (Object) A hash of HTTP headers returned by the remote URL
//     resource.
//   status - (Object) A hash of status codes returned by cURL.
//
// Topic: JSONP requests
// This request will return the contents of the specified url in JSONP format
// (but only if $enable_jsonp is enabled in the PHP script).
//
// Request:
// > ba-simple-proxy.php?url=http://example.com/&callback=foo
//
// Response:
// > foo({"contents": "<html>...</html>", "headers": {...}, "status": {...} })
//
// JSON object properties:
//   contents - (String) The contents of the remote URL resource.
//   headers - (Object) A hash of HTTP headers returned by the remote URL
//     resource.
//   status - (Object) A hash of status codes returned by cURL.
//
// Topic: Native requests
// This request will return the contents of the specified url in the format it
// was received in, including the same content-type and other headers (but only
// if $enable_native is enabled in the PHP script).
//
// Request:
// > ba-simple-proxy.php?url=http://example.com/&mode=native
//
// Response:
// > <html>...</html>
//
// Topic: Notes
// * Assumes magic_quotes_gpc=Off in php.ini
//
// Topic: Configuration Options
// These variables can be manually edited in the PHP file if necessary.
//   $enable_jsonp - Only enable <JSONP requests> if you really need to. If you
//     install this script on the same server as the page you're calling it
//     from, plain JSON will work. Defaults to false.
//   $enable_native - You can enable <Native requests>, but you should only do
//     this if you also whitelist specific URLs using $valid_url_regex, to avoid
//     possible XSS vulnerabilities. Defaults to false.
//   $valid_url_regex - This regex is matched against the url parameter to
//     ensure that it is valid. This setting only needs to be used if either
//     $enable_jsonp or $enable_native are enabled. Defaults to '/.*/' which
//     validates all URLs.
//
// ############################################################################
// 2015-12-19
mb_internal_encoding("UTF-8");
mb_http_output('UTF-8');
// Change these configuration options if needed, see above descriptions for info.
$enable_jsonp   =false;
$enable_native  =true;
$valid_url_regex='/.*/';
// 
function InitLang($lang) {
  $language='en_US';
  //if (ereg('ja', $_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
  if ('ja' === $lang) {
    $language='ja_JP.UTF-8';
  }
  debug_log(__LINE__.': language='.$language);
  // Set locale and default domain.
  putenv("_LANG=$language");
  setlocale(LC_MESSAGES, $language);
  $domain='messages';
  bindtextdomain($domain, "/ebs/www/wuwei.space/public_html/locale");
  textdomain($domain);
  bind_textdomain_codeset($domain, 'UTF-8');
}
//
function debug_log($str) {
  date_default_timezone_set("Asia/Tokyo");
  $datetime=date("Y/m/d (D) H:i:s", time());  //日時
  $request_url=$_SERVER["REQUEST_URI"];  //アクセスしたURL
  $client_ip=$_SERVER["REMOTE_ADDR"];    //クライアントのIP
  // if (strlen($str) > 1024) { $str=mb_substr($str, 0, 1024).'...'; }
  $msg = "{$datetime} {$str}";
  error_log($msg."\n", 3, "/var/log/nginx/wu_wei_proxy.log");
}
// resume an unicode decoded string to UTF-8 encoded string
function unicode_encode($str) {
  return preg_replace_callback("/\\\\u([0-9a-zA-Z]{4})/", "encode_callback", $str);
}
function encode_callback($matches) {
  $char = mb_convert_encoding(pack("H*", $matches[1]), "UTF-8", "UTF-16");
  return $char;
}
// ############################################################################
$url = $_GET['url'];
// debug_log(__LINE__.': url='.$url);
$url = str_replace(' ', '+', $url);
debug_log(__LINE__.': url='.$url);
preg_match('/^(.*)\/([^\/]*)$/', $url, $matches, PREG_OFFSET_CAPTURE);
$base = $matches[1][0];
$base = str_replace('http:', 'https:', $base);
debug_log(__LINE__.': base='.$base);
if (!$url) {
  // Passed url not specified.
  $contents = 'ERROR: url not specified';
  $status = array('http_code' => 'ERROR');
} else if (!preg_match($valid_url_regex, $url)) {
  // Passed url doesn't match $valid_url_regex.
  $contents = 'ERROR: invalid url';
  $status = array('http_code' => 'ERROR');
} else {
  $ch = curl_init($url);
  // POST
  if (strtolower($_SERVER['REQUEST_METHOD']) == 'post') {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $_POST);
  }
  // COOKIE
  if (isset($_GET['send_cookies'])) {
    $cookie = array();
    foreach ($_COOKIE as $key => $value) {
      $cookie[] = $key.'='.$value;
    }
    if (isset($_GET['send_session'])) {
      $cookie[] = SID;
    }
    $cookie = implode('; ', $cookie);
    curl_setopt($ch, CURLOPT_COOKIE, $cookie);
  }
  // OPTIONS
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
  curl_setopt($ch, CURLOPT_HEADER, true);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  if (isset($_GET['user_agent'])) {
    curl_setopt($ch, CURLOPT_USERAGENT, $_GET['user_agent']);
    debug_log(__LINE__.': GET User-Agent:'.$_GET['user_agent']);
  } else if (isset($_SERVER['HTTP_USER_AGENT'])) {
    curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
    debug_log(__LINE__.': SERVER User-Agent:'.$_SERVER['HTTP_USER_AGENT']);
  }
  list($header, $contents) = preg_split('/([\r\n][\r\n])\\1/', curl_exec($ch), 2);
  $status = curl_getinfo($ch);
  //debug_log(__LINE__.': status='.$status);
  curl_close($ch);
}
// 2015-11-28
header("Access-Control-Allow-Origin: *");
// 2019-11-17 allow info pane to show web site
// header("X-Frame-Options: SAMEORIGIN");
// Split header text into an array.
$header_text = preg_split('/[\r\n]+/', $header);
if ($_GET['mode'] == 'native') {
  if (!$enable_native) {
    $contents = 'ERROR: invalid mode';
    $status = array('http_code' => 'ERROR');
  }
  // Propagate headers to response.
  foreach ($header_text as $header) {
    if (preg_match('/^(?:Content-Type|Content-Language|Set-Cookie):/i', $header)) {
      header($header);
    }
  }
  // $contents=unicode_encode($contents);
  debug_log(__LINE__.': -PRE-  contents='.$contents);
  // 2019-12-21
  $contents = str_replace('<!doctype html>', '', $contents);
  $contents = str_replace('<!DOCTYPE html>', '', $contents);
  //
  $proxy="https://www.wuwei.space/kcua/server/proxy.php?mode=native&url=";

  if (strpos($base, 'https://www.wuwei.space/kcua') !== false) {
    $base = '';
  }

  // see https://stackoverflow.com/questions/406230/regular-expression-to-match-a-line-that-doesnt-contain-a-word
  // https://stackoverflow.com/questions/18558259/php-regex-match-something-not-starting-with-words-like-admin-login-and-s
  $pattern = '/(<link .*href=")((?!#|http:|https:|\/\/|\/)[^"]+")/';
  $replacement = '$1'.$proxy.$base.'/$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<link .*href=")(\/[^\/]+[^"]+")/';
  $replacement = '$1'.$proxy.$base.'$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<link .*href=")(http:[^"]+)/';
  $replacement = '$1'.$proxy.'$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<link .*href=")(\/\/[^"]+)/';
  $replacement = '$1'.$proxy.'http:$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  //
  $pattern = '/(<script .*src=")((?!#|http:|https:|\/\/|\/)[^"]+")/';
  $replacement = '$1'.$proxy.$base.'/$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<script .*src=")(\/[^\/]+[^"]+")/';
  $replacement = '$1'.$proxy.$base.'$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<script .*src=")(http:[^"]+)/';
  $replacement = '$1'.$proxy.'$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<script .*src=")(\/\/[^"]+)/';
  $replacement = '$1'.$proxy.'http:$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  //
  $pattern = '/(<img .*src=")((?!#|http:|https:|\/\/|\/)[^"]+")/';
  $replacement = '$1'.$proxy.$base.'/$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<img .*src=")(\/[^\/]+[^"]+")/';
  $replacement = '$1'.$proxy.$base.'$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<img .*src=")(http:[^"]+")/';
  $replacement = '$1'.$proxy.'$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<img .*src=")(\/\/[^"]+")/';
  $replacement = '$1'.$proxy.'http:$2';
  $contents = preg_replace($pattern, $replacement, $contents);
  $pattern = '/(<img .*)(srcset="[^"]+")/';
  $replacement = '$1';
  $contents = preg_replace($pattern, $replacement, $contents);
  //
  // $pattern = '/(<a .*href=")((?!#|http:|https:|\/\/|\/)[^"]+")/';
  // $replacement = '$1'.$proxy.$base.'/$2';
  // $contents = preg_replace($pattern, $replacement, $contents);
  // $pattern = '/(<a .*href=")(\/[^\/]+[^"]+")/';
  // $replacement = '$1'.$proxy.$base.'$2';
  // $contents = preg_replace($pattern, $replacement, $contents);
  // $pattern = '/(<a .*href=")(http:[^"]+)/';
  // $replacement = '$1'.$proxy.'$2';
  // $contents = preg_replace($pattern, $replacement, $contents);
  // $pattern = '/(<a .*href=")(\/\/[^"]+)/';
  // $replacement = '$1'.$proxy.'http:$2';
  // $contents = preg_replace($pattern, $replacement, $contents);

  $contents = trim($contents);
  debug_log(__LINE__.': -POST- contents='.$contents);

//   $contents = str_replace('</html>', '', $contents);

//   $path_parts = pathinfo($url);
//   $extension = strtolower($path_parts['extension']);
//   switch($extension) {
//     case "html":
//     case "htm":
//       $contents = $contents . <<< END
// <script type="text/javascript">
//   (function() {
//     window.onload = function(event) {
//       console.log('proxy window.onload','{$url}');
//       window.parent.wuwei.annotate.initModule('{$url}');
//     };
//     // see https://codepen.io/dhavalt10/pen/rGLBzB
//     // also https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onpopstate
//     history.pushState(null, null, location.href);
//     window.onpopstate = function () {
//       history.go(1);
//     };
//   })();
// </script>
// </html>
// END;
//     break;
//     case "": // Handle file extension for files ending in '.'
//     case NULL: // Handle no file extension
//     break;
//   }
  // header('Content-type: text/html');
  print $contents;
} else {
  // $data will be serialized into JSON data.
  $data = array();
  // Propagate all HTTP headers into the JSON data object.
  if (isset($_GET['full_headers'])) {
    $data['headers'] = array();
    foreach ($header_text as $header) {
      preg_match('/^(.+?):\s+(.*)$/', $header, $matches);
      if ($matches) {
        $data['headers'][$matches[1]] = $matches[2];
      }
    }
  }
  // Propagate all cURL request / response info to the JSON data object.
  if (isset($_GET['full_status'])) {
    $data['status'] = $status;
  } else {
    $data['status'] = array();
    $data['status']['http_code'] = $status['http_code'];
  }
  // Set the JSON data object contents, decoding it from JSON if possible.
  $decoded_json = json_decode($contents);
  $data['contents'] = $decoded_json ? $decoded_json : $contents;
  // Generate appropriate content-type header.
  $is_xhr=strtolower(isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest';
  header('Content-type: application/'.($is_xhr ? 'json' : 'x-javascript'));
  // Get JSONP callback.
  $jsonp_callback = $enable_jsonp && isset($_GET['callback']) ? $_GET['callback'] : null;
  // Generate JSON/JSONP string
  $json = json_encode($data);
  // debug_log(__LINE__.': json='.$json);
  print $jsonp_callback ? "$jsonp_callback($json)" : $json;
}
?>
