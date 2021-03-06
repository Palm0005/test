/**
 * Issue Model
 * =============
 *  
 * Parallel to inquiries, issue
 * is a special comment thread. Rule
 * comment-[r:answers]->issue-[r:questions]->(n)
 */
var settings  = require('../settings'),
    helpers   = require('../helpers.js'),
    parser    = require('../parser.js'),
    
    neo4j     = require('seraph')(settings.neo4j.host),
    queries   = require('decypher')('./queries/issue.cyp'),
    
    clc       = require('cli-color'),
    async     = require('async'),
    _         = require('lodash');
    
    

module.exports = {
  DATE: 'date',
  TYPE: 'type',
  MERGEABLE: 'mergeable',
  IRRELEVANT: 'irrelevant',
  WRONG: 'wrong',
  
  get: function(issue, next) {
    neo4j.query(queries.get_issue, {
      id: +issue.id
    }, function (err, node) {
      if(err) {
        next(err);
        return;
      }
      if(!node.length) {
        next(helpers.IS_EMPTY);
        return;
      }
      node[0].answers = _.filter(node[0].answers, 'id')
      // select current abstract based on the language chosen, fallback to english
      next(null, node[0]);
    })
  },
  /*
    Available params are limit, offset, order by.
    todo: count_issues
  */
  getMany: function(params, next) {
    var query = parser.agentBrown(queries.get_issues, params);
    // console.log(query)
    neo4j.query(query, params, function (err, nodes) {
      if(err) {
        next(err);
        return;
      }
      
      // select current abstract based on the language chosen, fallback to english
      next(null, nodes, {
        params: params
      });
    })
  },
  /*
    Create a new issue and assign it to the properties.user provided (Ctrl: req.user).
    Create the first "solution" as well.
    properties: {
      kind: <Issue.KIND>, // cfr. above.
      questioning: <ID>,  // list of questioning ids
      mentioning: [<ID>], // list of mentions integer IDS
      user:     { ... }
    }
  */
  create: function(properties, next) {
    var now = helpers.now(),
        q = parser.agentBrown(queries.create_issue, properties);
    neo4j.query(q, {
      username: properties.user.username,
      kind: properties.kind,
      exec_date: now.date,
      exec_time: now.time,
      questioning: properties.questioning,
      mentioning: properties.mentioning,
      solution:  properties.solution // YAML field
    }, function (err, nodes) {
      if(err || !nodes.length) {
        next(err||helpers.IS_EMPTY);
        return;
      }
      module.exports.get({
        id: nodes[0].id
      }, next);
    });
  },
  /*
    Create and attach a comment on the issue, i.e a solution or an observation
    name: name of the inquiry
    content: 
    username
  */
  createRelatedComment: function(issue, properties, next) {
    var now = helpers.now(),
        query = parser.agentBrown(queries.merge_issue_comment, properties);
    neo4j.query(query, {
      id: issue.id,
      first: properties.first, 
      content: properties.content,
      language: properties.language,
      username: properties.user.username,
      slug: helpers.text.slugify(properties.user.username + ' ' + JSON.stringify(properties.content)),
      creation_date: now.date,
      creation_time: now.time,
    }, function (err, node) {
      if(err) {
        next(err);
        return;
      }
      if(!node.length) {
        next(helpers.IS_EMPTY);
        return;
      }
      next(null, node[0]);
    })
  },
  
  /*
    Useful api for downvoting/upvoting or modify a specific issue.
    Note that You can modify the original one only if you're the owner of the comment.
  */
  update: function(issue, properties, next) {
    var now = helpers.now();
        // query = parser.agentBrown(queries.update_comment, properties);
    
    neo4j.query(queries.get_issue, {
      id: issue.id
    }, function (err, iss) {
      if(err) {
        next(err);
        return;
      }
      if(!iss.length) {
        next(helpers.IS_EMPTY);
        return;
      }
      iss = iss[0];
       // -> { make: 'Citroen', model: 'DS4', id: 1 }
      if(properties.upvoted_by) {
        iss.props.upvote = _.unique((iss.props.upvote || []).concat(properties.upvoted_by));
      } else if(properties.downvoted_by) {
        iss.props.downvote = _.unique((iss.props.downvote || []).concat(properties.downvoted_by));
      }
      iss.props.celebrity =  _.unique((iss.props.upvote || []).concat(iss.props.downvote|| [])).length;
      iss.props.score = (iss.props.upvote || []).length - (iss.props.downvote|| []).length;
      iss.props.last_modification_date = now.date;
      iss.props.last_modification_time = now.time;
      // user will follow the inquiry
      // upvote downvote with user username. (more readable)
      // score is changed relatively
      neo4j.save(iss.props, function (err, props) {
        if(err) {
          next(err);
          return;
        }
        iss.props = props;
        next(null, iss);
      })
    })
  },
  
  /*
    This method MUST NOT HAVE an http API access.
    Remove the inquiry permanently.
  */
  remove: function(issue, next) {
    neo4j.query(queries.remove_issue, {
      id: issue.id
    }, function (err) {
      if(err)
        next(err);
      else
        next();
    })
  }
}