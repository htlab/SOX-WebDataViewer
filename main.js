var version="0.5.13.4";

//接続先SOXサーバの情報
var boshService = "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/";
var xmppServer = "sox.ht.sfc.keio.ac.jp";
var jid = "";
var password = "";

//データ格納用オブジェクト
var soxdevices ={};
var soxdevices_to_autosubscribe ={};
var soxdevices_subscribed ={};
var soxdatastream ={};
var flag_autosubscribe = 0;

//ページがloadされたときに呼ばれる関数
window.onload = function() {
    $('.version').html(version);

    //このWebアプリが呼ばれたURLからパラメータ(クエリストリング)"s"
    //の内容を取得 (自動的にサブスクライブするべきセンサ名) し保存
    try{
	var tmp_array = getUrlVars()["s"].split(',');
	for (var i = 0; i < tmp_array.length; i++) {
	    soxdevices_to_autosubscribe[ window.btoa(unescape(encodeURIComponent( decodeURIComponent( tmp_array[i]) ))).replace(/[^a-zA-Z0-9]/gm, "") ] = "true";
	//alert(decodeURIComponent( tmp_array[i]) );
	    flag_autosubscribe++;
	}
    }catch(e){
    }


    $.mobile.loading('show', {text: 'SOXサーバ接続中', textVisible: true, textonly: false});
    $('#info-soxservername').html(xmppServer);
    $('#info-soxserverstatus').html('接続中...');

    //SoxClientとEventListenerを作成
    var client = new SoxClient(boshService, xmppServer, jid, password);
    var soxEventListener = new SoxEventListener();

    //Soxサーバに接続完了したときに呼ばれるコールバック関数
    soxEventListener.connected = function(soxEvent) {
	$('#info-soxserverstatus').html('接続済');
	$.mobile.loading('show', {text: 'デバイス発見中', textVisible: true, textonly: false});

	//一度すべてをunsubscribe
	client.unsubscribeAll();

	console.log("[main.js] Connected " + soxEvent.soxClient);
	status("Connected: " + soxEvent.soxClient);

	//サーバの中のデバイスを発見する
	if (!soxEvent.soxClient.discoverDevices()) {
	    status("[main.js] Couldn't get device list: " + soxEvent.soxClient);
	}
    };
    
    //Soxサーバ内のデバイス発見が完了したときに呼ばれるコールバック関数
    soxEventListener.discovered = function(soxEvent) {
	try {
	    $.mobile.loading('show', {text: 'デバイス読み込み中', textVisible: true, textonly: false});
	    console.log("[main.js] Discovered " + soxEvent.devices);
	    var libody = '';

	    //発見されたすべてのデバイスを並べ替える
	    soxEvent.devices.sort();

	    //発見されたすべてのデバイスをローカルに格納
	    for (var i = 0; i < soxEvent.devices.length; i++) {

		//名前が"?"のみで構成されるバグなデバイスを除く
		if(soxEvent.devices[i].nodeName.match(/[^\?]/)){
		
		    //<LI>タグのIDには、デバイスのnodeName名(UTF-8)をBase64化して
		    //さらにA-Z, a-z, 0-9のみの数字を取り出した文字列 (擬似的なハッシュ値)
		    //を入れています。"nodeName"の値はUTF-8を許容しているため
		    //そのままID属性に入れられない理由により。
		    libody += '<li id="' + window.btoa(unescape(encodeURIComponent( soxEvent.devices[i].nodeName))).replace(/[^a-zA-Z0-9]/gm, "") + '">'  + soxEvent.devices[i].nodeName + '</li>';

		    soxdevices[soxEvent.devices[i].nodeName] = soxEvent.devices[i];
		    soxdevices_subscribed[soxEvent.devices[i].nodeName] = 'false';
		}
	    }

	    //デバイスリストのULタグ内に、用意したLIタグ群を挿入し
	    //またそのLIタグがクリックされたときのハンドラを定義
	    $('#devices').prepend(libody).promise().done(function () {
		    $(this).on("click", "li", function () {
			    if(soxdevices_subscribed[$(this).text()] == 'false'){
				client.subscribeDevice(soxdevices[$(this).text()]);
				$(this).text( $(this).text() + "   [...]");
			    }else{
				//XXX: Temporarilly disabled due to a bug in unsubscribe (slash)(20151111)
				//client.unsubscribeDevice(soxdevices[$(this).text()]);
				//client.unsubscribeAll();
			    }
			});
		});

	    //ノード数を画面に表示
	    $('#info-numnodes').html(soxEvent.devices.length);

	    //画面上部のナビゲーション部の表示を更新
	    $('#DataStreamPageLinkToDeviceList a').attr('href', '#SensorListPage');
	    $('#SensorListPageLinkToDeviceList a').attr('href', '#SensorListPage');
	    $('#ConsolePageLinkToDeviceList a').attr('href', '#SensorListPage');
	    $('#DataStreamPageLinkToDeviceList a').html("センサリスト");
	    $('#SensorListPageLinkToDeviceList a').html("センサリスト");
	    $('#ConsolePageLinkToDeviceList a').html("センサリスト");

	    //if($.mobile.activePage.attr("id") == "SensorListPage"){
	    try{
		$('#devices').listview("refresh");
	    }catch(e){
	    }

	    //ロード表示を隠す
	    $.mobile.loading('hide');

	    //ページロード時のパラメータ"s"から指定された
	    //自動サブスクライブ開始センサを、実際にサブスクライブする
	    for(var prop in soxdevices_to_autosubscribe){
		//alert(prop);
		$('#' + prop).trigger("click");
	    }	
	    if( flag_autosubscribe > 0){
		$('body').pagecontainer('change', '#DataStreamPage');
	    }

	}catch(e){
	    printStackTrace(e);
	}
    };

    //Soxサーバ内のデバイス発見に失敗した時に呼ばれるコールバック関数を登録
    soxEventListener.discoveryFailed = function(soxEvent) {
	status("Discovery Failed: " + soxEvent.soxClient);
	console.log("[main.js] Discovery failed " + soxEvent);
    };

    //Soxサーバ内への接続に失敗した時に呼ばれるコールバック関数を登録
    soxEventListener.connectionFailed = function(soxEvent) {
	console.log("[main.js] Connection Failed " + soxEvent.soxClient);
	status("Connection Failed: " + soxEvent.soxClient);
    };

    //Soxサーバ内デバイスにサブスクライブ(講読)完了した時に呼ばれるコールバック関数を登録
    soxEventListener.subscribed = function(soxEvent) {
	status("Subscribed: " + soxEvent.device);

	//データ構造への格納
	soxdevices_subscribed[soxEvent.device.nodeName] = 'true';

	//デバイスリストの表示色を変更
	//$('#' + soxEvent.device.nodeName.replace(/ /g,"")).attr("style", "background-color:#ffcc33;");
	var mynode = $('#' + window.btoa(unescape(encodeURIComponent( soxEvent.device.nodeName) )).replace(/[^a-zA-Z0-9]/gm,"") )
	mynode.attr("style", "background-color:#ffcc33;");

	mynode.text( mynode.text().replace(/\[...\]/, "[講読中]"));

	$('#devices').listview("refresh");		
    };


    //Soxサーバ内デバイスにサブスクライブ(講読)失敗した時に呼ばれるコールバック関数を登録
    soxEventListener.subscriptionFailed = function(soxEvent) {
	status("Subscription Failed: " + soxEvent.device);
    };

    //Soxサーバ内デバイスからアンサブスクライブ(講読終了)完了した時に呼ばれるコールバック関数を登録
    soxEventListener.unsubscribed = function(soxEvent) {
	status("Unsubscribed: " + soxEvent.device);

	//デバイスリストの表示色を変更
	soxdevices_subscribed[soxEvent.device.nodeName] = 'false';
	console.log('[main.js]Unsubscribed' + soxEvent.device);
    };

    //Soxサーバ内デバイスからアンサブスクライブ(講読終了)失敗した時に呼ばれるコールバック関数を登録
    soxEventListener.unsubscriptionFailed = function(soxEvent) {
	status("Unsubscription Failed: " + soxEvent.device);
	console.log('[main.js]Unsubscription failed' + soxEvent.device);
    };

    //デバイスからメタ情報を受信したときに呼ばれるコールバック関数を登録
    soxEventListener.metaDataReceived = function(soxEvent) {
	/**
	 * SoXサーバからデバイスのメタ情報を受信すると呼ばれる。
	 * 受信したメタ情報に基づいて、Device内にTransducerインスタンスが生成されている。
	 */
	status("Meta data received: " + soxEvent.device);
    };

    //デバイスからセンサデータを受信したときに呼ばれるコールバック関数を登録
    soxEventListener.sensorDataReceived = function(soxEvent) {
	/**
	 * SoXサーバからセンサデータを受信すると呼ばれる。
	 * 受信したデータはTransducerインスタンスにセットされ、そのTransducerがイベントオブジェクトとして渡される。
	 */
	var now = new Date();
	var nU =  now.getTime();

	//データを格納
	soxdatastream[nU] = soxEvent.device;

	//Listviewの左に出すサムネイル画像をデータの中から検索し、
	//Base64の形で埋め込まれた画像があればはじめの画像を抽出する。
	var thumbnail_class = "";
	var thumbnail_html = "";
	if(soxdatastream[nU].toString().indexOf("data:image") > -1){
	    thumbnail_class = " class='ui-li-has-thumb' ";
	    thumbnail_html = soxdatastream[nU].toString().replace(/(.*)data:image\/(jpeg|jpg|gif|png);base64,([0-9a-zA-Z\-\+\/\=\_\!\.\:]+),(.*)/, function(){return "<img src='data:image/" + RegExp.$2 + ";base64," + RegExp.$3 + "' style='width:100px;' />"});
	}else{
	    thumbnail_html = "<img src='' style='width:100px; display:none;' />";
	}

	//ListViewの一番始めに挿入する<li>タグを生成し
	var html = '<li id="soxdata' + nU + '" style="border: 1px solid #ff0000; background-color: #fff0f0;" ' + thumbnail_class + '><a href="#" onclick="showpopup(' + nU + ')">' + thumbnail_html + now.toLocaleString() + '<br/>' + soxEvent.device.toString().replace(/^Device\[nodeName\=/, "")  + '</a></li>';
	//ListViewの一番始めに挿入
	try{
	    //$('#soxdata').prepend(html).promise().done(function(){ });
	    $('#soxdata').prepend(html).listview("refresh");
	}catch(e){
	}
	//3秒後に「新着表示」の赤いスタイルを無効化するタイマーを発動
	setTimeout('stophighlight("soxdata' + nU + '");', 3000);

	status("Sensor data received: " + soxEvent.device);
    };


    //コンソールページが表示される度に呼ばれ、ListViewをリフレッシュするコールバック関数を登録
    $(document).on('pagecontainerchange', '#ConsolePage', function() {
	    $('#consolelog').listview("refresh");
	});

    //センサデータページが表示される度に呼ばれ、ListViewをリフレッシュするコールバック関数を登録
    $(document).on('pagecontainerchange', '#DataStreamPage', function() {
	    $('#soxdata').listview("refresh");
	});

    //イベントリスナを登録
    client.setSoxEventListener(soxEventListener);
    //実際にサーバへ接続を開始する
    client.connect();
};


// Listviewの中のアイテムが選択されたときに jQuery Mobileのpopupを表示する関数
function showpopup(id){
    $('#soxdatabody').html('');
    $('#soxdatabody').json2html( convert(soxdatastream[id].name, soxdatastream[id], 'open'), transforms.object);

    //SOXデータの中にある、base64エンコードされた画像に<img>タグを付加し可視化
    var tmps = $('#soxdatabody').html();
    var tmps2 = tmps.replace(/data:image\/(jpeg|jpg|gif|png);([0-9a-zA-Z\-\+\/\=\_\!\.\:\,]+)/gm, function(){return "<img src='data:image/" + RegExp.$1 + ";" + RegExp.$2 + "'/>"});
    $('#soxdatabody').html( tmps2 );

    regEvents();
    $('#soxdatapopup').popup( "open" )
}

// Listviewにアイテムが追加されるごとに起動されるタイマーから呼ばれる、
// アイテムの一時的なスタイル (新着アイテム) を消す関数
function stophighlight(id){
    $('#' + id).attr("style", "");
}

// コンソールタブへの表示を行う関数
function status(message) {
    var html = '<li class="ui-li-static ui-body-inherit">' + (new Date().toLocaleString()) + "<br/>" + message + '<br/><br/></li>';
    $('#consolelog').prepend(html);
    if($.mobile.activePage.attr("id") == "ConsolePage"){
	$('#consolelog').listview("refresh");
    }
}

//////////////////////////////////////////////////////////////////////////////
//json2html visualization関係
//////////////////////////////////////////////////////////////////////////////
var transforms = {
	'object':{'tag':'div','class':'package ${show} ${type}','children':[
		{'tag':'div','class':'header','children':[
			{'tag':'div','class':function(obj){

				var classes = ["arrow"];

				if( getValue(obj.value) !== undefined ) classes.push("hide");
				
				return(classes.join(' '));
			}},
			{'tag':'span','class':'name','html':'${name}'},
			{'tag':'span','class':'value','html':function(obj) {
				var value = getValue(obj.value);
				if( value !== undefined ) return(" : " + value);
				else return('');
			}},
			{'tag':'span','class':'type','html':'${type}'}
		]},
		{'tag':'div','class':'children','children':function(obj){return(children(obj.value));}}
	]}
};

function getValue(obj) {
	var type = $.type(obj);

	//Determine if this object has children
	switch(type) {
		case 'array':
		case 'object':
			return(undefined);
		break;

		case 'function':
			//none
		        //return('function'); 
		break;

		case 'string':
			return("'" + obj + "'");
		break;

		default:
			return(obj);
		break;
	}
}

//Transform the children
function children(obj){
	var type = $.type(obj);

	//Determine if this object has children
	switch(type) {
		case 'array':
		case 'object':
			return(json2html.transform(obj,transforms.object));
		break;

		default:
			//This must be a litteral
		break;
	}
}

function convert(name, obj, show) {
	
	var type = $.type(obj);

	if(show === undefined) show = 'closed';
	
	var children = [];

	//Determine the type of this object
	switch(type) {
		case 'array':
			//Transform array
			//Itterrate through the array and add it to the elements array
			var len=obj.length;
			for(var j=0;j<len;++j){	
				//Concat the return elements from this objects tranformation
			    //children[j] = convert(j, obj[j]);

				var myname = j;
				try{
				    myname = j + " (" + obj[j].name + ")";
				} catch (e) {
				}
				children[j] = convert(myname, obj[j]);

			}
		break;

		case 'object':
			//Transform Object
			var j = 0;
			for(var prop in obj) {
			    if($.type(obj[prop]) != 'function'){
				children[j] = convert(prop,obj[prop]);
				j++;
			    }
			}	
		break;

		case 'function':
			children = obj;		    
		break;

		default:
			//This must be a litteral
			children = obj;
		break;
	}

	return( {'name':name,'value':children,'type':type,'show':show} );
	
}

function regEvents() {

	$('.header').click(function(){
		var parent = $(this).parent();

		if(parent.hasClass('closed')) {
			parent.removeClass('closed');
			parent.addClass('open');
		} else {
			parent.removeClass('open');
			parent.addClass('closed');
		}		
	});
}

    

// Read a page's GET URL variables and return them as an associative array.
function getUrlVars()
{
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
	for(var i = 0; i < hashes.length; i++)
	    {
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	    }
	return vars;
}