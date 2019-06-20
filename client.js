/* global TrelloPowerUp */

var Promise = TrelloPowerUp.Promise;

var SIGMA_ICON = './sigma.svg';

var getBadges = function(t){
  return t.card('id')
  .then(function(card){
    return t.get('card', 'shared', 'difficulty-average')
    .then(function(difficultyAverage){
      return t.get('card', 'shared', 'difficulty-min')
      .then(function(difficultyMin) {
        return t.get('card', 'shared', 'difficulty-max')
        .then(function(difficultyMax) {
          return t.get('card', 'shared', 'difficulty-count')
          .then(function(difficultyCount) {
            var badges = [];
            if(difficultyCount) {
              if(difficultyAverage) badges.push({
                text: 'average: ' + parseFloat(difficultyAverage).toLocaleString(undefined,{minimumFractionDigits:2})
              });
              if(difficultyMin) badges.push({
                text: 'min: ' + parseFloat(difficultyMin).toLocaleString(undefined,{minimumFractionDigits:2})
              });
              if(difficultyMax) badges.push({
                text: 'max: ' + parseFloat(difficultyMax).toLocaleString(undefined,{minimumFractionDigits:2})
              });
              if(difficultyCount) badges.push({
                text: 'count: ' + difficultyCount
              });
            }
            return badges;
          });
        });
      });
    });
  });
};


var getBoardButtons = function(t) {
  // get all the cards
  return t.get('board', 'shared', 'costFields')
  .then(function(costFields) {
  return t.cards('id', 'name', 'idList', 'labels')
  .then(function(cards) {
    var getCosts = [];
    // get all the card costs
    cards.forEach(function(card){
      getCosts.push(t.get(card.id, 'shared', 'costs'))
    });
    return Promise.all(getCosts)
    .then(function(costArray) {
      var sums = Array(costFields.length).fill(0);
      // for each card
      costArray.forEach(function(cardCosts) {
        // for each cost on the card
        if (cardCosts && Array.isArray(cardCosts)) {
          cardCosts.forEach(function(cost,idx) {
            if(cost)
              sums[idx] += parseFloat(cost);
          });
        }
      });
      var boardButtons = [];
      sums.forEach(function(sum, idx) {
        boardButtons.push({
          icon: SIGMA_ICON,
          text: costFields[idx] + ': ' + parseFloat(sum).toLocaleString(undefined,{minimumFractionDigits:2}),
          callback: function(t) {
            return t.lists('id', 'name')
            .then(function(lists){
              var entries = [];
              var activeIds = cards.map(function(card){return card.id;});
              
              var summaryByColumn = function(t) {
                var listSums = {};
                var columnEntries = [];
                costArray.forEach(function(cardCosts, cardIdx) {
                  if (cardCosts && cardCosts.length > 0) {
                    var cardId = cards[cardIdx].id;
                    // for each active card
                    if (activeIds.indexOf(cardId) > -1) {
                      // if it has this cost attached
                      if (cardCosts[idx]) {
                        // see if listSums already has a sum under this listId
                        if (!listSums[cards[cardIdx].idList]) {
                          // if not create it
                          listSums[cards[cardIdx].idList] = 0;
                        }
                        // add the cost to the list sum
                        listSums[cards[cardIdx].idList] += parseFloat(cardCosts[idx]);
                      }
                    }
                  }
                });
                Object.keys(listSums).forEach(function(listId) {  
                  var listName = lists.find(function(list){return listId == list.id}).name;
                  columnEntries.push({
                    text: listName + ': ' + parseFloat(listSums[listId]).toFixed(0).toLocaleString(undefined,{minimumFractionDigits:2})
                  });
                });
                return t.popup({
                  title: 'Summary by Column',
                  items: columnEntries
                });
              }

              var summaryByLabel = function(t) {
                var listSums = {};
                var columnEntries = [];
                cards.forEach(function(card, cardIdx){ 
                  if (costArray[cardIdx]) {
                    if (card.labels.length > 0) {
                      card.labels.forEach(function(label) {
                        var displayName = label.name || label.color;
                        if (listSums[displayName]) {
                          listSums[displayName] += parseFloat(costArray[cardIdx][idx]);
                        } else {
                          listSums[displayName] = parseFloat(costArray[cardIdx][idx]);
                        }
                      });
                    }
                  }
                });

                for (var listSum in listSums) {        
                  columnEntries.push({text: listSum + ': ' + parseFloat(listSums[listSum]).toFixed(0).toLocaleString(undefined,{minimumFractionDigits:2})});
                }
                return t.popup({
                  title: 'Summary by Label',
                  items: columnEntries
                });
              }
              
              entries.push({text: '🔍 Summary by Column...', callback: summaryByColumn});
              entries.push({text: '🔍 Summary by Label...', callback: summaryByLabel});
              costArray.forEach(function(cardCosts, cardIdx) {
                if (cardCosts && cardCosts.length > 0 && cardCosts[idx]) {
                  var cost = cards[cardIdx].id;
                  if (activeIds.indexOf(cost) > -1) {
                    var cb = function(a){t.showCard(a);};
                    entries.push({              
                        text: parseFloat(cardCosts[idx]).toLocaleString(undefined,{minimumFractionDigits:2}) + ' - ' + cards.find(function(card){return card.id == cost;}).name,
                        callback: cb.bind(null, cost)
                    });
                  }
                }
              });
              
              return t.popup({
                title: 'Cost Summary',
                items: entries
              });
            });
          }
        });
      });
      return boardButtons;
    });
  });
  });
}

var getSettings = function(t) {
  return t.get('board', 'shared', 'costFields')
  .then(function(costFields) {
    return t.popup({
      title: 'Manage Cost Fields',
      items: function(t, options) {
        var buttons = [{
          text: options.search !== '' ? 'Add cost field: ' + options.search : '(Enter a title to add cost field)',
          callback: function(t) {
            costFields.push(options.search);
            return t.set('board', 'shared', 'costFields', costFields)
            .then(function() {
              return getSettings(t);
            });
          }
        }];
        if (costFields && Array.isArray(costFields) && costFields.length > 0) {
          costFields.forEach(function(costField, idx) {
            buttons.push({
              text: costField,
              callback: function(t) {
                return t.popup({
                  title: 'Set Field Name',
                  items: function(t, subopt) {
                    return [{
                      text: subopt.search !== '' ? 'Rename field to "' + subopt.search + '"': '(Enter a new name for this field.)',
                      callback: function(t) {
                        costFields[idx] = subopt.search;
                        return t.set('board', 'shared', 'costFields', costFields)
                        .then(function() {
                          return getSettings(t);             
                        });
                      }
                    }, {
                      text: 'Delete ' + costField + ' field.',
                      callback: function(t) {
                        // not only do we need to delete this field from the costField array, 
                        // we also need to delete that index from any card-level costs object
                        return t.cards('id')
                        .then(function(cards) {
                          var requests = [];
                          cards.forEach(function(card) {
                            requests.push(t.get(card.id, 'shared', 'costs'));
                          });
                          return Promise.all(requests)
                          .then(function(cardCostsArray) {
                            if (cardCostsArray) {
                              var updates = [];
                              cardCostsArray.forEach(function(cardCosts, cardIdx) {
                                if (cardCosts && cardCosts[idx]) {
                                  cardCosts[idx] = false;
                                }
                                updates.push(t.set(cards[cardIdx].id, 'shared', 'costs', cardCosts));
                              });
                              if (updates) {
                                return Promise.all(updates)
                                .then(function() {
                                  costFields.splice(idx, 1);
                                  return t.set('board', 'shared', 'costFields', costFields)
                                  .then(function(){
                                    return getSettings(t);                                   
                                  });
                                });
                              } else {
                                costFields.splice(idx, 1);
                                return t.set('board', 'shared', 'costFields', costFields)
                                .then(function(){
                                  return getSettings(t);                                   
                                });
                              }
                            } else {
                              costFields.splice(idx, 1);
                              return t.set('board', 'shared', 'costFields', costFields)
                              .then(function(){
                                return getSettings(t);                                   
                              });
                            }
                          });
                        });
                      }
                    }]
                  },
                  search: {
                    placeholder: costFields[0]
                  }
                });
              }
            });
          });
        }
        return buttons;
      },
      search: {
        placeholder: 'Enter new cost field',
        empty: 'Error',
        searching: 'Processing...'
      }
    });
  });
}

var getButtons = function(t) {
  return t.get('board', 'shared', 'costFields')
  .then(function(costFields){
  return t.get('card', 'shared', 'costs')
  .then(function(costs){
    var buttons = [];  
    
    costFields.forEach(function(cost, idx){
      buttons.push({
        icon: SIGMA_ICON, 
        text: costs && costs[idx] ? costFields[idx] + ': ' + parseFloat(costs[idx]).toLocaleString(undefined,{minimumFractionDigits:2}) :'Add ' + costFields[idx] + '...',
        callback: t.memberCanWriteToModel('card') ? function(t) {
          return t.popup({
            title: 'Set ' + costFields[idx] + '...',
            items: function(t, options) {
              var newCost = parseFloat(options.search).toFixed(0)
              var buttons = [{
                text: !Number.isNaN(parseFloat(options.search)) ? 'Set ' + costFields[idx] + ' to ' + parseFloat(newCost).toLocaleString(undefined,{minimumFractionDigits:2}) : '(Enter a number to set ' + costFields[idx] + '.)',
                callback: function(t) {
                  if (newCost != 'NaN') {
                    var newCosts = costs ? costs : Array(costFields.length).fill(false);
                    newCosts[idx] = newCost;
                    console.log(newCosts);
                   
                    return t.set('card','shared','difficulty-average', (newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                      return accumulator + (currentValue ? parseFloat(currentValue) : 0);
                    }, 0) / Math.max(1, newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                      return accumulator + (currentValue ? 1 : 0);
                    }, 0))).toFixed(2))
                    .then(function() {
                      return t.set('card','shared','difficulty-max', (newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                        return Math.max(accumulator, (currentValue ? parseFloat(currentValue) : 0))
                      }, 0)).toFixed(0))
                      .then(function(){
                        return t.set('card','shared','difficulty-min', (newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                          return Math.min(accumulator, (currentValue ? parseFloat(currentValue) : 1e9))
                        }, 1e9)).toFixed(0))
                        .then(function() {
                          return t.set('card','shared','difficulty-count', newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                            return accumulator + (currentValue ? 1 : 0);
                          }, 0))
                          .then(function() {
                            return t.set('card','shared','costs', newCosts)
                            .then(function() {
                              return t.set('board','shared','refresh',Math.random())
                              .then(function() {
                                return t.closePopup();
                              });
                            });
                          });
                        });
                      });
                    });
                    
                  }
                  return t.closePopup();
                }
              }];
              if (costs && costs[idx]) {
                buttons.push({
                  text: 'Remove ' + costFields[idx] + '.',
                  callback: function(t) {
                    var newCosts = costs ? costs : Array(costFields.length).fill(false);
                    newCosts[idx] = false;
                    console.log(newCosts);
                    
                    t.set('card','shared','difficulty-average', (newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                      return accumulator + (currentValue ? parseFloat(currentValue) : 0);
                    }, 0) / Math.max(1, newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                      return accumulator + (currentValue ? 1 : 0);
                    }, 0))).toFixed(2))
                    .then(function() {
                      return t.set('card','shared','difficulty-max', (newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                        return Math.max(accumulator, (currentValue ? parseFloat(currentValue) : 0))
                      }, 0)).toFixed(0))
                      .then(function(){
                        return t.set('card','shared','difficulty-min', (newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                          return Math.min(accumulator, (currentValue ? parseFloat(currentValue) : 1e9))
                        }, 1e9)).toFixed(0))
                        .then(function() {
                          return t.set('card','shared','difficulty-count', newCosts.reduce(function(accumulator, currentValue, currentIndex, array) {
                            return accumulator + (currentValue ? 1 : 0);
                          }, 0)).
                          then(function() {
                            t.set('card','shared','costs', newCosts);
                          })
                        });
                      });
                    });
                    
                    return t.closePopup();
                  }
                });
              }
              return buttons;
            },
            search: {
              placeholder: 'Enter Cost',
              empty: 'Error',
              searching: 'Processing...'
            }
          });
        } : null
      });
    });
    return buttons;
  });
  });
}

TrelloPowerUp.initialize({
  'card-badges': function(t, options){
    return getBadges(t);
  },
  'card-buttons': function(t, options) {
    return getButtons(t);
  },
  'show-settings': function(t, options) {
    return getSettings(t);
  }
});
