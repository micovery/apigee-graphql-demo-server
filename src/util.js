// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const _ = require('lodash');

function findByIdOrName(collection, idOrName, clz) {
    let item = _.find(collection, (e) =>{
        return (idOrName === e.id || idOrName=== e.name);
    });

    return clz.cast(item);
}

function addNewItem(collection, properties, clz) {
    let item = new clz(properties);
    collection.push(item);
    return item;
}

function applyRegexFilters(object, regex_filters) {
    if (!regex_filters) {
        return true;
    }

    for (let field_name in regex_filters) {
        let regex_filter = regex_filters[field_name];
        if (!regex_filter.test(object[field_name])) {
            return false;
        }
    }

    return true;
}

function buildRegexFilters(filters) {
    if (!filters) {
        return null;
    }

    let regex_filters = {};
    for (let field in filters) {
        let regex_str = filters[field];

        let matches = regex_str.match(/\/([gmisuy]{0,6})$/);               //extract the regex modifiers
        let regex_mods = (matches)?matches[1]: "";
        let regex_text = regex_str
            .replace(/\/.*$/, '')                                           //remove / from the end
            .replace(/^.*\//, '');                   //remove / from the start

        regex_filters[field] = new RegExp(regex_text, regex_mods);
    }

    return regex_filters;
}

function copyData(dest, src) {
    return Object.assign(dest, {data: src.data});
}



module.exports = {
    findByIdOrName,
    addNewItem,
    applyRegexFilters,
    buildRegexFilters,
    copyData
};