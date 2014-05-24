requirejs.config({
    baseUrl: 'require',
    map: {
        '*': {
            'backbone': 'browser/backbone',
            'underscore': 'browser/underscore',
            'numeric': 'numeric-1.2.6.min'
        }
    },
    waitSeconds: 60,
    shim: {
        'numeric-1.2.6.min': {
            exports: 'numeric'
        },
        'gamma': {
            exports: 'module'
        },
        'd3': {
            exports: 'd3'
        },
        'bootstrap' : {
            deps: ['jquery'],
            exports: 'bootstrap'
        },
        'browser/backbone': {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
        'browser/underscore': {
            exports: '_'
        },
        'Tween': {
            exports: 'TWEEN'
        },
        'jquery.cookie': {
            deps: ['jquery']
        },
        'sha1': {
            exports: 'Sha1',
        },
    }
});

requirejs(['jquery', 'jquery.cookie', 'underscore', 'backbone', 'bootstrap', 'mustache', 'NavView', 'HomeView', 'QuestionsView', 'QuestionDataModel', 'QuestionView', 'TestInstanceCollection', 'TestInstanceView', 'TestModel', 'StatsModel', 'StatsView', 'AssessView', 'DebugView', 'AboutView', 'ActivityModel', 'ActivityView', 'spinController'],
function(  $,        jqueryCookie,    _,            Backbone,   bootstrap,   Mustache,   NavView,   HomeView,   QuestionsView,   QuestionDataModel,   QuestionView,   TestInstanceCollection, TestInstanceView, TestModel, StatsModel,   StatsView,   AssessView, DebugView, AboutView, ActivityModel,   ActivityView,   spinController) {

    var QScoreModel = Backbone.Model.extend({
        idAttribute: "qid"
    });

    var QScoreCollection = Backbone.Collection.extend({
        model: QScoreModel
    });

    var QuestionModel = Backbone.Model.extend({
        idAttribute: "qid"
    });

    var QuestionCollection = Backbone.Collection.extend({
        model: QuestionModel,
        comparator: function(question) {return question.get("number");}
    });

    var TestCollection = Backbone.Collection.extend({
        model: TestModel.TestModel,
        comparator: function(test) {return -test.get("number");}, // sort by negative number, so larger numbers first
    });

    var UserModel = Backbone.Model.extend({
        idAttribute: "uid"
    });

    var UserCollection = Backbone.Collection.extend({
        model: UserModel
    });

    var AppModel = Backbone.Model.extend({
        initialize: function() {
            this.set({
                page: "home",
                currentAssessmentName: null,
                currentAssessmentLink: null,
                pageOptions: {},
                deployMode: false,
                apiServer: "http://localhost:3000",
                authUID: null,
                authName: null,
                authDate: null,
                authSignature: null,
                authPerms: [],
                userUID: null,
                userName: null
            });
            var c9RE = /c9.io/;
            if (c9RE.test(window.location.href)) {
                this.set({
                    apiServer: window.location.protocol + "//" + window.location.hostname
                });
            }
            var authURL = this.apiURL("auth");
            var deployRE = /prairielearn\.engr\.illinois\.edu/;
            if (deployRE.test(window.location.href)) {
                this.set({
                    deployMode: true,
                    apiServer: "https://prairielearn2.engr.illinois.edu:443"
                });
                authURL = "/cgi-bin/auth";
            }
            var that = this;
            $.getJSON(authURL, function(data) {
                that.set({
                    authUID: data.uid,
                    authName: data.name,
                    authDate: data.date,
                    authSignature: data.signature,
                    userUID: data.uid,
                    userName: data.name
                });
                $.getJSON(that.apiURL("users/" + that.get("authUID")), function(userData) {
                    that.set("authPerms", userData.perms);
                });
            });
            this.listenTo(Backbone, "tryAgain", this.tryAgain);
        },

        apiURL: function(path) {
            return this.get("apiServer") + "/" + path;
        },

        tryAgain: function() {
            this.trigger("change");
        },

        hasPermission: function(operation) {
            var perms = this.get("authPerms");
            if (!perms)
                return false;

            var permission = false;
            if (operation === "overrideScore" && _(perms).contains("superuser"))
                permission = true;
            if (operation === "seeQID" && _(perms).contains("superuser"))
                permission = true;
            if (operation === "seeQuestions" && _(perms).contains("superuser"))
                permission = true;
            if (operation === "seeDebug" && _(perms).contains("superuser"))
                permission = true;
            if (operation === "changeUser" && _(perms).contains("superuser"))
                permission = true;
            return permission;
        }
    });

    var AppView = Backbone.View.extend({
        initialize: function() {
            this.router = this.options.router; // hack to enable random question URL re-writing
            this.requester = this.options.requester;
            this.qScores = this.options.qScores;
            this.questions = this.options.questions;
            this.eScores = this.options.eScores;
            this.tests = this.options.tests;
            this.tInstances = this.options.tInstances;
            this.users = this.options.users;
            this.currentView = null;
            this.listenTo(this.model, "change", this.render);
            this.listenTo(this.model, "change:userUID", this.reloadUserData);
            this.navView = new NavView.NavView({model: this.model, users: this.users});
            this.navView.render();
            $("#nav").html(this.navView.el);
        },

        render: function() {
            var target = document.getElementById('content');
            var spinner = spinController.startSpinner(target);
            var view;
            switch (this.model.get("page")) {
            case "home":
                view = new HomeView.HomeView({model: this.model});
                break;
            case "question":
                var qid = this.model.get("pageOptions").qid;
                if (qid === "random") {
                    var i = Math.floor(Math.random() * this.questions.length);
                    qid = this.questions.at(i).get("qid");
                    this.router.navigate("questions/" + qid, {trigger: true});
                    return;
                }
                var questionDataModel = new QuestionDataModel.QuestionDataModel({}, {appModel: this.model, requester: this.requester, qid: this.model.get("pageOptions").qid});
                view = new QuestionView.QuestionView({model: questionDataModel, qScore: this.qScores.get(this.model.get("pageOptions").qid)});
                break;
            case "stats":
                var statsModel = new StatsModel.StatsModel({}, {appModel: this.model, requester: this.requester});
                view = new StatsView.StatsView({model: statsModel, questions: this.questions});
                break;
            case "activity":
                var activityModel = new ActivityModel.ActivityModel({}, {appModel: this.model, requester: this.requester});
                view = new ActivityView.ActivityView({model: activityModel});
                break;
            case "questions":
                view = new QuestionsView.QuestionsView({questions: this.questions, qScores: this.qScores});
                break;
            case "assess":
                view = new AssessView({appModel: this.model, tests: this.tests, tInstances: this.tInstances, router: this.router});
                break;
            case "testInstance":
                var tiid = this.model.get("pageOptions").tiid;
                var tInstance = this.tInstances.get(tiid);
                var tid = tInstance.get("tid");
                var test = this.tests.get(tid);
                this.model.set("currentAssessmentName", test.get("type") + " " + test.get("number"));
                this.model.set("currentAssessmentLink", "#ti/" + tiid);
                view = new TestInstanceView({model: tInstance, test: test, appModel: this.model, questions: this.questions});
                break;
            case "testQuestion":
                var tiid = this.model.get("pageOptions").tiid;
                var qNumber = this.model.get("pageOptions").qNumber;
                var qIndex = qNumber - 1;
                var tInstance = this.tInstances.get(tiid);
                var tid = tInstance.get("tid");
                var test = this.tests.get(tid);
                this.model.set("currentAssessmentName", test.get("type") + " " + test.get("number"));
                this.model.set("currentAssessmentLink", "#ti/" + tiid);
                var qid;
                if (tInstance.has("qids"))
                    qid = tInstance.get("qids")[qIndex];
                else
                    qid = test.get("qids")[qIndex];
                var questionDataModel = new QuestionDataModel.QuestionDataModel({}, {appModel: this.model, requester: this.requester, qid: qid, tiid: tiid, tInstances: this.tInstances});
                test.callWithHelper(function() {
                    var helper = test.get("helper");
                    if (helper.adjustQuestionDataModel)
                        helper.adjustQuestionDataModel(questionDataModel, test, tInstance);
                });
                view = new QuestionView.QuestionView({model: questionDataModel, test: test, tInstance: tInstance});
                break;
            case "chooseTestQuestion":
                var tiid = this.model.get("pageOptions").tiid;
                var qInfo = this.model.get("pageOptions").qInfo;
                var skipQNumbers = this.model.get("pageOptions").skipQNumbers;
                var tInstance = this.tInstances.get(tiid);
                var tid = tInstance.get("tid");
                var test = this.tests.get(tid);
                this.model.set("currentAssessmentName", test.get("type") + " " + test.get("number"));
                this.model.set("currentAssessmentLink", "#ti/" + tiid);
                var qids;
                if (tInstance.has("qids"))
                    qids = tInstance.get("qids");
                else
                    qids = test.get("qids");
                var skipQIDs = _(skipQNumbers).map(function(qNumber) {return qids[qNumber - 1];});
                var that = this;
                test.callWithHelper(function(test) {
                    var qIndex = test.get("helper").chooseRandomQuestion(qInfo, test, tInstance, skipQIDs);
                    var qNumber = qIndex + 1;
                    that.router.navigate("q/" + tiid + "/" + qNumber, {trigger: true});
                });
                return;
            case "about":
                view = new AboutView.AboutView();
                break;
            case "debug":
                view = new DebugView({model: this.model, questions: this.questions, tests: this.tests, tInstances: this.tInstances});
                break;
            }
            this.showView(view);
            spinController.stopSpinner(spinner);
        },

        showView: function(view) {
            if (this.currentView != null) {
                this.currentView.close();
            }
            this.currentView = view;
            view.render();
            $("#content").html(view.el);
            $('[data-toggle=tooltip]').tooltip();
        },

        reloadUserData: function() {
            this.tInstances.fetch({reset: true});
        }
    });

    var AppRouter = Backbone.Router.extend({
        routes: {
            "questions/:qid": "goQuestion",
            "activity": "goActivity",
            "questions": "goQuestions",
            "stats": "goStats",
            "assess": "goAssess",
            "q/:tiid/:qNumber": "goTestQuestion",
            "cq/:tiid/:qInfo(/not/:skipQNumbers)": "goChooseTestQuestion",
            "ti/:tiid": "goTestInstance",
            "about": "goAbout",
            "debug": "goDebug",
            "*actions": "goHome"
        },

        initialize: function(options) {
            this.model = options.model;
        },

        goHome: function(actions) {
            this.model.set({
                "page": "home",
                "pageOptions": {}
            });
        },

        goQuestion: function(qid) {
            this.model.set({
                "page": "question",
                "pageOptions": {qid: qid}
            });
        },

        goActivity: function() {
            this.model.set({
                "page": "activity",
                "pageOptions": {}
            });
        },

        goStats: function() {
            this.model.set({
                "page": "stats",
                "pageOptions": {}
            });
        },

        goQuestions: function(actions) {
            this.model.set({
                "page": "questions",
                "pageOptions": {}
            });
        },

        goAssess: function() {
            this.model.set({
                "page": "assess",
                "pageOptions": {}
            });
        },

        goTestQuestion: function(tiid, qNumber) {
            this.model.set({
                "page": "testQuestion",
                "pageOptions": {tiid: tiid, qNumber: qNumber}
            });
        },

        goChooseTestQuestion: function(tiid, qInfo, skipQNumbers) {
            skipQNumbers = (skipQNumbers == null) ? [] : skipQNumbers.split(",");
            this.model.set({
                "page": "chooseTestQuestion",
                "pageOptions": {tiid: tiid, qInfo: qInfo, skipQNumbers: skipQNumbers}
            });
        },

        goTestInstance: function(tiid) {
            this.model.set({
                "page": "testInstance",
                "pageOptions": {tiid: tiid}
            });
        },

        goAbout: function() {
            this.model.set({
                "page": "about",
                "pageOptions": {}
            });
        },

        goDebug: function() {
            this.model.set({
                "page": "debug",
                "pageOptions": {}
            });
        },
    });

    var Requester = function(options) {
        this.model = options.model;
    };

    Requester.prototype.headers = function() {
        return {
            "X-Auth-UID": String(this.model.get("authUID")),
            "X-Auth-Name": String(this.model.get("authName")),
            "X-Auth-Date": String(this.model.get("authDate")),
            "X-Auth-Signature": String(this.model.get("authSignature")),
        };
    };

    Requester.prototype.getJSON = function(url, successFn) {
        $.ajax({
            dataType: "json",
            url: url,
            success: successFn,
            headers: this.headers(),
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('ajax error');
            }
        });
    };

    Requester.prototype.postJSON = function(url, data, successFn) {
        $.ajax({
            dataType: "json",
            url: url,
            type: "POST",
            processData: false,
            data: JSON.stringify(data),
            contentType: 'application/json; charset=UTF-8',
            success: successFn,
            headers: this.headers(),
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('ajax error: ' + textStatus);
            }
        });
    };

    Requester.prototype.postJSONWithTimeout = function(url, data, timeout, successFn, errorFn) {
        $.ajax({
            dataType: "json",
            url: url,
            type: "POST",
            processData: false,
            data: JSON.stringify(data),
            contentType: 'application/json; charset=UTF-8',
            timeout: timeout,
            success: successFn,
            error: errorFn,
            headers: this.headers()
        });
    };

    Requester.prototype.getHtml = function(url, successFn) {
        $.ajax({
            dataType: "html",
            url: url,
            success: successFn,
            headers: this.headers(),
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('ajax error');
            }
        });
    };

    $(function() {
        var appModel = new AppModel();
        var requester = new Requester({model: appModel});
        var appRouter = new AppRouter({model: appModel});

        var qScores = new QScoreCollection([], {
            url: function() {return appModel.apiURL("users/" + appModel.get("userUID") + "/qScores");}
        });
        var questions = new QuestionCollection([], {
            url: function() {return appModel.apiURL("questions");}
        });
        var tests = new TestCollection([], {
            url: function() {return appModel.apiURL("tests");}
        });
        var tInstances = new TestInstanceCollection.TestInstanceCollection([], {
            tests: tests,
            url: function() {return appModel.apiURL("tInstances/?uid=" + appModel.get("userUID"));}
        });
        var users = new UserCollection([], {
            url: function() {return appModel.apiURL("users");}
        });

        Backbone.history.start();

        $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
            options.headers = {
                "X-Auth-UID": String(appModel.get("authUID")),
                "X-Auth-Name": String(appModel.get("authName")),
                "X-Auth-Date": String(appModel.get("authDate")),
                "X-Auth-Signature": String(appModel.get("authSignature")),
            };
        });

        appModel.on("change:authUID", function() {
            qScores.fetch({success: function() {
                questions.fetch({success: function() {
                    tests.fetch({success: function() {
                        tInstances.fetch({success: function() {
                            users.fetch({success: function() {
                                var appView = new AppView({model: appModel, qScores: qScores, questions: questions, tests: tests, tInstances: tInstances, requester: requester, router: appRouter, users: users});
                                appView.render();
                            }});
                        }});
                    }});
                }});
            }});
        });
    });
});
