// local-cache.js: localStorage with expirations, using cookies as backup if localStorage is not available.
// by Ian Davis, http://www.linkedin.com/in/ianhd and http://seeitornot.co
//
// Version 1.1
//
// Updates:
//  1.1: Removed extensions for Storage, as IE did not recognize them
//  1.0: Initial version
//
// Feedback?  Please submit here: http://code.google.com/p/local-cache/issues/list

function setExpiration(key, expireDate) {
    var expirations = localStorage.getItem("localStorageExpirations"); // "key1^11/18/2011 5pm|key2^3/10/2012 3pm"
    var arr = expirations ? expirations.split('|') : []; // ["key1^11/18/2011 5pm","key2^3/10/2012 3pm"] or []

    for (var i = 0; i < arr.length; i++) {
        var expiration = arr[i]; // "key1^11/18/2011 5pm"
        if (expiration.split('^')[0] == key) { // found a match
            arr.splice(i, 1); // remove, we'll add it w/ updated expiration later
            break;
        }
    } // next: key^exp pair

    if (expireDate > new Date()) {
        arr.push(key + "^" + expireDate.toString());
    }
    if (arr.length) {
        localStorage.setItem("localStorageExpirations", arr.join("|"));
    } else {
        localStorage.removeItem("localStorageExpirations");
    }
}

function getExpiration(key) {
    var expirations = localStorage.getItem("localStorageExpirations"); // "key1^11/18/2011 5pm|key2^3/10/2012 3pm"
    if (expirations) {
        var arr = expirations.split("|"); // ["key1^11/18/2011 5pm","key2^3/10/2012 3pm"]
        for (var i = 0; i < arr.length; i++) {
            var expiration = arr[i]; // "key1^11/18/2011 5pm"
            var k = expiration.split('^')[0]; // key1
            var e = expiration.split('^')[1]; // 11/18/2011 5pm
            if (k == key) { // found match; return expiration and remove expiration if it's expired
                var now = new Date();
                var eDate = new Date(e);
                if (now > eDate) {
                    // remove expiration
                    arr.splice(i, 1);
                    if (arr.length > 0) {
                        localStorage.setItem("localStorageExpirations", arr.join("|"));
                    } else {
                        localStorage.removeItem("localStorageExpirations");
                    }
                }
                return new Date(e);
            }
        } // next: key^exp pair
    }
    return null;
}

function getExpirationDate(expObject) {
    var now = new Date();
    var ret = new Date();

    if (typeof expObject == 'undefined') {
        ret.setDate(now.getDate() + 1); // default to one day from now
        // console.log("local-cache.js plugin: expiration not specified, using " + ret.toString());
        return ret;
    }

    if (expObject.date && expObject.date instanceof Date) {
        // console.log("local-cache.js plugin: expiration set to " + expObject.date.toString());
        return expObject.date;
    }

    if (expObject.atMidnight) {
        ret.setDate(now.getDate() + 1);
        ret.setHours(0, 0, 0, 0);
        // console.log("local-cache.js plugin: expiration set to " + ret.toString());
        return ret; // return if this is specified
    }

    // made it to here? user wants specifics
    if (expObject.minutes) {
        ret.setMinutes(now.getMinutes() + expObject.minutes);
    }
    if (expObject.hours) {
        ret.setHours(now.getHours() + expObject.hours);
    }
    if (expObject.days) {
        ret.setDate(now.getDate() + expObject.days);
    }
    if (expObject.months) {
        ret.setMonth(now.getMonth() + expObject.months);
    }
    if (expObject.years) {
        ret.setYear(now.getFullYear() + expObject.years);
    }

    // console.log("local-cache.js plugin: expiration set to " + ret.toString());
    return ret;
}

function setCacheItem(key, value, expireDate) {
    var val = null;
    if (value == null) {
        localStorage.removeItem(key);
        setExpiration(key, new Date(0));
        return null;
    } else if (value instanceof Array) {
        // assume json array, e.g., [{ make: "Honda", year: 2012 },{ make: "Toyota", year: 2010 }]
        value = { isJsonArr: true, arr: value };
        val = JSON.stringify(value);
    } else if (value instanceof Object) {
        // assume single json obj, e.g., { make: "Honda", year: 2012 }
        value.isJsonObj = true; // add this flag, so we can check it on retrieval
        val = JSON.stringify(value);
    } else {
        val = value;
    }
    localStorage.setItem(key, val);
    setExpiration(key, expireDate);
}

function getCacheItem(key) {
    // first, check to see if this key is in localstorage
    if (!localStorage.getItem(key)) {
        return null;
    }

    // ex: key = "favColor"
    var now = new Date();
    var expireDate = getExpiration(key);
    if (expireDate && now <= expireDate) {
        // hasn't expired yet, so simply return
        var value = localStorage.getItem(key);
        try {
            var parsed = JSON.parse(value);
            if (parsed.isJsonObj) {
                delete parsed.isJsonObj; // remove the extra flag we added in setCacheItem method; clean it up
                return parsed;
            } else if (parsed.isJsonArr) {
                delete parsed.isJsonArr; // remove the extra flag we added in setCacheItem method; clean it up
                return parsed.arr;
            } else {
                return value; // return the string, since it could be trying to do JSON.parse("3") which will succeed and not throw an error, but "3" isn't a json obj
            }
        } catch (e) {
            // string was not json-parsable, so simply return it as-is
            return value;
        }
    }

    // made it to here? remove item
    localStorage.removeItem(key);
    return null;
}

function lcSetCookie(key, value, expireDate) {
    var val = null;
    key = escape(key);

    if (value == null) {
        document.cookie = key + "=deleted; expires=" + new Date(0).toUTCString() + "; path=/";
        return null;
    } else if (value instanceof Array) {
        // assume json array, e.g., [{ make: "Honda", year: 2012 },{ make: "Toyota", year: 2010 }]
        value = { isJsonArr: true, arr: value };
        val = escape(JSON.stringify(value));
    } else if (value instanceof Object) {
        // assume single json obj, e.g., { make: "Honda", year: 2012 }
        value.isJsonObj = true; // add this flag, so we can check it on retrieval
        val = escape(JSON.stringify(value));
    } else {
        val = escape(value);
    }

    // console.log("local-cache.js plugin: setting cookie, " + key + "=" + val + "; expires=" + expireDate.toUTCString());
    document.cookie = key + "=" + val + "; expires=" + expireDate.toUTCString() + "; path=/";
}

function lcGetCookie(key) {
    key = escape(key);
    var result = new RegExp('(?:^|; )' + key + '=([^;]*)').exec(document.cookie);
    var value = result ? unescape(result[1]) : null;

    if (value == null) {
        return null;
    }

    try {
        var parsed = JSON.parse(value);
        if (parsed.isJsonObj) {
            delete parsed.isJsonObj; // remove the extra flag we added in setCacheItem method; clean it up
            return parsed;
        } else if (parsed.isJsonArr) {
            delete parsed.isJsonArr; // remove the extra flag we added in setCacheItem method; clean it up
            return parsed.arr;
        } else {
            return value; // return the string, since it could be trying to do JSON.parse("3") which will succeed and not throw an error, but "3" isn't a json obj
        }
    } catch (e) {
        // string was not json-parsable, so simply return it as-is
        return value;
    }

    // idea from jQuery.cookie.js...
    // var result, decode = options.raw ? function (s) { return s; } : decodeURIComponent;
    // return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decode(result[1]) : null;
}

;jQuery.cacheItem = function (key, value, options) {
    // is this a GET?
    // if # args is 1 (scenario = "var x = $.cacheItem(key);")
    // or if # args is 2 && value is an object which has useCookies set (scenario = "var x = $.cacheItem(key, { useCookies: true });")
    if (arguments.length == 1 || (arguments.length == 2 && typeof value == "object" && value && value.useCookies)) {
        // override exist for using cookies?
        if (value && value.useCookies) {
            // console.log("local-cache.js plugin: using cookies to get item (specified by { useCookies: true } override)");
            return lcGetCookie(key);
        } else {
            // no override provided, so auto-detect
            if (typeof localStorage != 'undefined' && typeof Storage != 'undefined') {
                // console.log("local-cache.js plugin: using localStorage to get item (auto-detected)");
                return getCacheItem(key);
            } else {
                // console.log("local-cache.js plugin: using cookies to get item (auto-detected)");
                return lcGetCookie(key);
            }
        }
    } else {
        // this is a SET, examples...
        // $.cacheItem(key, { prop1: "val1" }, { useCookie: true, expires: { days: 5 } });
        // $.cacheItem(key, 15);
        // $.cacheItem(key, null); // for clearing out a cacheitem
        var expireDate = getExpirationDate(options && (options.expires || options.expire)); // in case user passed in options.expire or .expires

        // use localStorage if available, cookies otherwise
        if (options && options.useCookies) {
            // console.log("local-cache.js plugin: using cookies to set item (specified by { useCookies: true } override)");
            lcSetCookie(key, value, expireDate);
        } else {
            if (typeof localStorage != 'undefined' && typeof Storage != 'undefined') {
                // console.log("local-cache.js plugin: using localStorage to set item (auto-detected)");
                setCacheItem(key, value, expireDate);
            } else {
                // console.log("local-cache.js plugin: using cookies to set item (auto-detected)");
                lcSetCookie(key, value, expireDate);
            }
        }
    }
}