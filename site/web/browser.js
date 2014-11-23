$(function(){
//////////////////////////////////////////////////////////////////////////////

/* Date concerning functions */

function validateDateFormat(s){
    if(!/^[0-9]{8}$/.test(s)) return false;
    var year = parseInt(s.slice(0,4), 10),
        month = parseInt(s.slice(4,6), 10),
        day = parseInt(s.slice(6, 8));
    if(year < 2014) return false;
    if(month < 1 || month > 12) return false;
    if(day < 1) return false;

    var dayMax = 0;
    if(2 == month){
        if( ((0 == year % 100)?(0 == year % 400):(0 == year % 4)) )
            // is leap year
            dayMax = 29;
        else
            dayMax = 28;
    } else {
        if(month <= 7)
            dayMax = ((1 == month % 2)?31:30);
        else
            dayMax = ((1 == month % 2)?30:31);
    };
    if(day > dayMax) return false;
    return [year, month, day]; 
};

function compareDate(a, b){ // if a<=b
    var year1 = parseInt(a.slice(0,4), 10),
        month1 = parseInt(a.slice(4,6), 10),
        day1 = parseInt(a.slice(6, 8)),
        hour1 = parseInt(a.slice(8, 10)),
        minute1 = parseInt(a.slice(10, 12));
    var year2 = parseInt(b.slice(0,4), 10),
        month2 = parseInt(b.slice(4,6), 10),
        day2 = parseInt(b.slice(6, 8)),
        hour2 = parseInt(b.slice(8, 10)),
        minute2 = parseInt(b.slice(10, 12));

    var aBigger = false;
    if(year1 > year2)
        aBigger = true;
    else if (year1 == year2)
        if(month1 > month2)
            aBigger = true;
        else if(month1 == month2)
            if(day1 > day2)
                aBigger = true;
            else if(day1 == day2)
                if(hour1 > hour2)
                    aBigger = true;
                else if(hour1 == hour2)
                    if (minute1 > minute2)
                        aBigger = true;

    return !aBigger;
};


/* Get satellite image from given filename */

var loadDataCache = {}
var loadData = function(filename, callback){
    if(!/^[0-9]{12}\.((IR[1-4])|VIS)\.(FULL|NORTH|SOUTH)\.png$/.test(filename))
        return false;

    var datemonth = filename.slice(0, 6);
    var url = 'http://mtsat-2.neoatlantis.org/data/' + datemonth + '/';
    url += filename.slice(0, 12);
    if(filename.slice(13, 15) == 'IR') 
        url += '.ir';
    else
        url += '.vis';
    url += '/' + filename;

    if(undefined !== loadDataCache[filename]){
        callback(img);        
    } else {
        var img = new Image();
        img.src = url;
        img.onload = function(){
            if(
                !this.complete ||
                typeof this.naturalWidth == "undefined" ||
                this.naturalWidth == 0
            )
                loadDataCache[filename] = false;
            else
                loadDataCache[filename] = img;
            callback(loadDataCache[filename]);
        };
    };
};


/* Retrive index file (log.txt) and auto parse */
var indexFileCache = {}, dataFileMetadata = {};
function loadIndexFile(dateMonth, callback){
    function parser(s){
        var sp = s.split('\n'), lp, range, filename, filenameS;
        for(var i in sp){
            if(!sp[i]) continue;
            lp = sp[i].trim().split('\t');
            range = lp[2].trim().slice(1,-1).split(',');
            scale = lp[3].trim().slice(1,-1).split(',');
            filename = lp[0].trim();
            filenameS = filename.split('.');
            dataFileMetadata[filename] = {
                'filename': filename,
                'time': filenameS[0],
                'date': filenameS[0].slice(0, 8),
                'dateMonth': filenameS[0].slice(0, 6),
                'channel': filenameS[1],
                'south': 'FULL' == filenameS[2] || 'SOUTH' == filenameS[2],
                'north': 'FULL' == filenameS[2] || 'NORTH' == filenameS[2],
                'range': {
                    x1: range[0],
                    y1: range[1],
                    x2: range[2],
                    y2: range[3],
                },
                'scale': {
                    min: scale[0],
                    max: scale[1],
                },
            };
        };
    };
    if(undefined !== indexFileCache[dateMonth]){
        parser(indexFileCache[dateMonth]);
        callback();
    } else {
        $.get(
            'http://mtsat-2.neoatlantis.org/data/' + dateMonth + '/log.txt',
            function(s){
                indexFileCache[dateMonth] = s;
                parser(s);
                callback();
            }
        );
    };
};

//////////////////////////////////////////////////////////////////////////////

/* command to load a image, process it and show */

function showCloudAtlas(filename){
    // bound to the button, which, when clicked, calls this function
    var metadata = dataFileMetadata[filename];
    if(!metadata) return alert('无数据。');

    loadData(filename, function(img){
        var cacheCanvas = $('#imgLoadCache')[0];
        var cacheCanvasContext = cacheCanvas.getContext('2d'); 

        // copy the size to canvas
        var width = img.width, height = img.height;
        cacheCanvasContext.canvas.width = width;
        cacheCanvasContext.canvas.height = height;

        // copy the data to srcctx
        cacheCanvasContext.clearRect(0, 0, width, height);
        cacheCanvasContext.drawImage(img, 0, 0, width, height);
    });
};


/* filter date list */

var dataFilterStart, dataFilterEnd, dataFilterChannel;
function filterDateList(){
    // the filter updates the list in UI by given start and end.  date list
    // being filtered(`dataFileMetadata`) is maintained by 'loadIndexFile'
    // function.
    
    // append to list
    $('[name="data-list"]').empty();
    var list = [];
    
    for(var filename in dataFileMetadata){
        var metadata = dataFileMetadata[filename];
        if(!(
            compareDate(dataFilterStart, metadata.date) &&
            compareDate(metadata.date, dataFilterEnd)
        ))
            continue;

        if(metadata.channel != dataFilterChannel)
            continue;

        list.push(metadata);
    };

    list.sort(function(a,b){
        return compareDate(a.time, b.time);
    });

    for(var i in list){
        var display = list[i].time.slice(0,4) + '-'
                    + list[i].time.slice(4,6) + '-'
                    + list[i].time.slice(6,8)
                    + '<font color="#999">T</font>'
                    + list[i].time.slice(8, 10) + ':'
                    + list[i].time.slice(10,12)
                    + '<font color="#999">Z</font>'
        ;
        $('[name="data-list"]').append(
            $('<div>').append(
                $('<button>', {
                    'type': 'button',
                })
                    .html(display)
                    .addClass('button-date')
                    .click((function(f){
                        return function(){
                            showCloudAtlas(f);
                        }
                    })(list[i].filename))
            )
        );
    };
};


/* initialize interface */

function validateDateRange(){
    var viewDateRangeStart = $('[name="view-date-range-start"]').val(),
        viewDateRangeEnd = $('[name="view-date-range-end"]').val();

    // if validation passed, they will be numbers taken apart [YYYY, MM, DD]
    var dateRangeStart = validateDateFormat(viewDateRangeStart),
        dateRangeEnd = validateDateFormat(viewDateRangeEnd);
    
    if(false === dateRangeStart || false === dateRangeEnd)
        return false;

    if(!compareDate(viewDateRangeStart, viewDateRangeEnd))
        return false;

    if(!compareDate('20141119', viewDateRangeStart))
        return false;

    var nowtime = new Date(), nowtimeStr = '', nowtimeY, nowtimeM, nowtimeD;
    nowtimeY = nowtime.getUTCFullYear();
    nowtimeM = nowtime.getUTCMonth() + 1;
    nowtimeD = nowtime.getUTCDate();
    
    nowtimeStr = String(nowtimeY);
    if(nowtimeM < 10) nowtimeStr += '0';
    nowtimeStr += String(nowtimeM);
    if(nowtimeD < 10) nowtimeStr += '0';
    nowtimeStr += String(nowtimeD);

    if(!compareDate(viewDateRangeEnd, nowtimeStr))
        return false;

    // [[YYYY, MM, DD], [YYYY, MM, DD], 'YYYYMMDD', 'YYYYMMDD']
    return [dateRangeStart, dateRangeEnd, viewDateRangeStart, viewDateRangeEnd];
};


$('#choose-date-range').click(function(){
    var dateRange = validateDateRange();
    if(false === dateRange)
        return alert('输入的日期范围有误。起始日期必须早于终止日期，且不早于2014年11月19日; 终止日期不得晚于今日。');

    var year = dateRange[0][0], month = dateRange[0][1];

    // set date filter range
    dataFilterStart = dateRange[2]; // str
    dataFilterEnd = dateRange[3]; // str
    dataFilterChannel = $('[name="view-channel"]').val(); // str

    function toDateMonth(year, month){
        return String(year) + ((month < 10)?('0' + String(month)):String(month));
    };
    var list = [toDateMonth(year, month)];
    while(year != dateRange[1][0] && month != dateRange[1][1]){
        month += 1;
        if(month > 12){
            month = 1;
            year += 1;
        };
        list.push(toDateMonth(year, month));
    };

    for(var i=0; i<list.length; i++)
        loadIndexFile(list[i], filterDateList);
});

//////////////////////////////////////////////////////////////////////////////
});
