const utf8 = require('is-utf8')

const strstr = function(char, charset){
    var charset = charset.split("");
    return charset.indexOf(char) !== -1;
}



const shannon = function(str){
    return _shannon(Buffer(str));
}


function StrSearch(opts){
    var opts = opts || {}
    this.charset = opts.CHARSET || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-+_~!@#$%^&*./<>?\\|";
    this.threshold = opts.THRESHOLD || 4;
    this.maxLine = opts.MAXLINE || 120;
    this.FILTER_WS_STRINGS = opts.FILTER_WS_STRINGS || true
    this.SHANNON_THRESHOLD = opts.SHANNON_THRESHOLD || 3.9
    this.inString = false;
    this.count = 0;
    this.strings = [];
    this.wsTermString = false;
    this.str = "";
    this.strEntry = "";
    this.strExit = false;
    this.strTerminator=/null/;
    this.line = "";
    this.loop = this.mainLoop.bind(this);
    this.results = [];
}


StrSearch.prototype.free = function(){
    this.inString = false;
    this.wsTermString = false;
    this.str = "";
    this.strEntry = "";
    this.strExit = false;
    this.strTerminator=/null/;
}

StrSearch.prototype.reset = function(){
    this.free();
    this.line = "";
    this.strings = [];
    this.count = 0;

}

StrSearch.prototype.checkLineLen = function(line){
    this.line = line 
    return (this.line.length > this.maxLine);
}


StrSearch.prototype.findEntry = function(char){
    var _this = this;

    if(strstr(char, "\"'`")){
        this.strEntry = char;
        this.strTerminator = new RegExp('[^' + char + ']');
        this.count++;
        return true;
    } else if(strstr(char, "= \t\n:")){
        this.strEntry = char;
        this.wsTermString = true;
        this.strTerminator = new RegExp('[^' + char + ']');
        this.count++;
        return true;
    }
    if(this.strEntry != "" && strstr(char, this.charset)){
        this.inString = true;
        return false;
    }
    return false;
}


StrSearch.prototype.collect = function(char){
    if(!this.wsTermString && !this.strTerminator.exec(char)){
        this.inString = false;
        this.strExit = true;
    } else if (this.wsTermString && strstr(char, "\n ;")){
        this.inString = false;
        this.strExit = true;
    } else if (this.wsTermString && this.line.length === this.count+1){
        this.inString = false;
        this.strExit = true;
    } else if (!this.wsTermString && this.line.length === this.count+1){
        this.inString = false;
        this.strExit = true;
        this.strEntry = "";
        this.wsTermString = false;
        this.str = "";
        return true;
    } else if(!this.strExit){
        if(strstr(char,this.charset)){
            this.str += char;
            this.count++;
        } else{
            this.strExit = true
        }
    }
    if(this.strExit){
        if(this.str.length > this.threshold){
        this.strings.push(this.str)    
        }
        this.free();
        this.count++;
    }
}


StrSearch.prototype.mainLoop = function(char){
    if(!this.inString){
        if(this.findEntry(char)){
            return;
        };
    }
    if(this.inString){
        this.collect(char)
    }
}


StrSearch.prototype.scan = function(line){
    // First, reset state. This sets the current set of found strings, 
    // and the state of things like whether or not we are collecting or are looking for a whitespace delimiter
    this.reset();
    // Ensure that the string has a newline at the end. 
    // If it doesn't, then detecting strings in certain languages will fail as they terminate on a newline
    // And we look for a newline terminator there.
    this.line = (line[line.length-1] !== "\n")? line + "\n": line;
    // Split the incoming line into individual characters
    var lineArray = this.line.split("");
    /* Call this.loop on each character, which is a ref to this.mainLoop that is forcefully bound to the correct 'this' context.
    this.mainLoop is broken out like this, roughly:
    1. Check to see if we are currently in a string and collecting:
        False: 
            call this.findEntry, which checks to see if the character is a start-string token:
                True:   return immediately. The current character is some kind of start token. 
                        findEntry has already changed the state to in-string:True, and we don't want to collect a " or something like that.
                False: Continue looping until a start-string token is found.
        True:
            call this.collect. this.collect will check to see if the string is in our character set, or if it's the end-string token that matches our start-string token, and set state appropriately.
            If it determines that this character is a character that should be collected, i.e. we are in a string, it's not an end-string token, and it's within the characterset: this.str += char

    2. Once this.collect finds the matching end token, it will take the current value of this.str, which is the characters that have been collected thus far, and store it as a string in this.strings.
        After storing the value, it calls this.free(). this.free will perform a psuedo-reset of state, erasing this.str( which stores the characters found in the valid string we just saved ), and resetting state like inString and the state of tokens that we're looking for, etc.

    3. This loop continues until we reach the end of the string, at which point an array of all strings we found during the process will be returned.
    */

    lineArray.forEach(this.loop);
    // This is where any filtering logic on the final results should go.
    // At this point, the entire line has been parsed and any strings placed in this.strings.
    // Some minor filtering is done here, deduping and then verifying all characters are valid utf8

    //this.strings = [ ...new Set(this.strings)]
    //this.strings = this.strings.filter((string)=>{utf8(new Buffer(string))})

    return this.strings;
}



module.exports = function(line, opts){
    const strSearch = new StrSearch(opts)
    return strSearch.scan(line);
}