import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import OfflineStorage from 'core/js/offlineStorage';
import ScoringSet from 'core/js/ScoringSet';
import Passmark from './Passmark';
import Attempts from './Attempts';
import Attempt from './Attempt';
import Marking from './Marking';
import Reset from './Reset';
import {
  getScaledScoreFromMinMax
} from 'extensions/adapt-contrib-scoring/js/scoring';

export default class TestSet extends ScoringSet {

  initialize(options = {}, subsetParent = null) {
    this._model = options.model;
    this._initConfig();
    this._initQuestions();
    this._hasReset = false;

    super.initialize({
      ...options,
      _id: this._config._id,
      _type: 'test'
    }, subsetParent);
  }

  /**
   * @extends
   * @todo Do we need an equivalent `Adapt.trigger('assessments:register', state, assessmentModel);` as before?
   */
  register() {
    super.register(this);
  }

  /**
   * @private
   * @todo Suffix all config classes with 'Config' or 'Model'? 'ConfigModel'?
   */
  _initConfig() {
    this._config = this.model.get('_test');
    this._passmark = new Passmark(this._config._passmark);
    this._attempts = new Attempts(this._config._attempts);
    this._attempt = new Attempt(this);
    this._marking = new Marking(this._config?._questions?._canShowMarking, this._config?._suppressMarking);
    this._resetConfig = new Reset(this._config._reset);
  }

  /**
   * @private
   * @todo Can remove async if not using the await. `_initQuestions` will need to be called from reset if left uncommented.
   * @todo What is `_assessmentId` used for - is this still needed?
   * @todo Does this also need to be set on blocks as in previous assessment?
   * @todo Add option to `_suppressFeedback` so user can review once completed and no attempts remaining?
   */
  async _initQuestions() {
    // @todo: probably not necessary to await here as doesn't matter if gets applied to all questions before banking/randomisation modifiers
    // await Data.whenReady();

    const isMarkingEnabled = this.marking.isEnabled && !(this.marking.isSuppressed && this.attempts.hasRemaining);

    this.questions.forEach(model => {
      model.set({
        _canShowFeedback: this._config?._questions?._canShowFeedback ?? false,
        _canShowMarking: isMarkingEnabled,
        _canShowModelAnswer: isMarkingEnabled && (this._config?._questions?._canShowModelAnswer ?? false),
        _isPartOfAssessment: true,
        _testId: this.id
      }, { pluginName: '_test' });
    });
  }

  /**
   * @extends
   */
  _setupListeners() {
    super._setupListeners();

    this.listenTo(Adapt, {
      'router:location': this.onRouterLocation
    });
  }

  /**
   * @override
   */
  restore() {
    const storedData = OfflineStorage.get(this.saveStateName)?.[this.id];

    if (storedData) {
      const data = OfflineStorage.deserialize(storedData);
      this.attempts.restore(data[0]);
      this.attempt.restore(data[1]);
    }

    // @todo: previously `assessments:restored` so need to check which plugins use this
    // @todo: do we need to send state when it can just be retrieved from assessment anyway?
    Adapt.trigger('assessment:restored', this);
    // Adapt.trigger('assessment:restored', this.state, this);
  }

  /**
   * @extends
   */
  update() {
    Logging.debug(`${this.id} minScore: ${this.minScore}, maxScore: ${this.maxScore}`);
    // Logging.debug(`${this.id} scores: ${JSON.stringify(this.scores)}`);
    Logging.debug(`${this.id} score: ${this.score}, scaledScore: ${this.scaledScore}`);
    Logging.debug(`${this.id} isAttemptComplete: ${this.isAttemptComplete}, isComplete: ${this.isComplete}, isPassed: ${this.isPassed}`);
    if (this.attempt) this.attempt.update();
    super.update();
    if (Adapt.get('_isStarted')) this._saveState();
  }

  /**
   * Reset all models
   * @todo Need preReset and postReset triggers as before?
   * @todo Previously returned true/false - don't think this is needed
   * @todo Should `attempts` ever be reset?
   * @todo Doesn't complete properly if scrolled to without reload
   * @returns {Promise}
   */
  async reset() {
    this.scoringSets.forEach(model => model.reset(this.resetConfig._scoringType, true));
    this.nonScoringSets.forEach(model => model.reset(this.resetConfig._nonScoringType, true));
    this._attempt = new Attempt(this);
    this._hasReset = true;
    await Adapt.deferUntilCompletionChecked();
    Adapt.trigger('assessment:reset', this);
    // Adapt.trigger('assessments:reset', this.getState(), this);

    if (this.canReload) {
      this._reload();
    } else if (this.resetConfig._scrollTo) {
      this.attempt.start();
      Adapt.navigateToElement(this.model.get('_id'));
    }
  }

  /**
   * Reload the page and scroll to assessment if configured
   * @private
   */
  _reload() {
    const id = this.resetConfig._scrollTo ? this.model.get('_id') : Adapt.location._currentId;
    Backbone.history.navigate(`#/id/${id}`, { replace: true, trigger: true });
  }

  /**
   * Returns the model containing the `_test` config
   * @returns {AdaptModel}
   */
  get model() {
    return this._model;
  }

  /**
   * @override
   */
  get models() {
    const models = this.model.getChildren().toArray();
    return this.filterModels(models);
  }

  /**
   * Returns whether all models have been added
   * @returns {Boolean}
   */
  get isAllModelsAdded() {
    return this.model.get('_requireCompletionOf') !== Number.POSITIVE_INFINITY;
  }

  /**
   * Returns all `_isAvailable` component models
   * @todo '_isAvailable' isn't inherited so unavailable blocks won't mean unavailable children and vice versa
   * @returns {[ComponentModel]}
   */
  get components() {
    return this.models.reduce((models, model) => models.concat(model.getChildren().toArray()), []);
    // return this.model.findDescendantModels('component').filter(model => model.get('_isAvailable'));
  }

  /**
   * Returns all `_isAvailable` question models
   * @returns {[QuestionModel]}
   */
  get questions() {
    return this.components.filter(model => model.get('_isQuestionType'));
    // return this.components.filter(model => model.getTypeGroup('question'));
    // return this.model.findDescendantModels('question').filter(model => model.get('_isAvailable'));
  }

  /**
   * @override
   * @todo Return questions so scoringSets can always be used in queries?
   * @todo If using buckets it isn't limited to questions
   * @todo Not actually a set - is this confusing?
   * @borrows questions as scoringSets
   * @returns {[QuestionModel]}
   */
  get scoringSets() {
    return this.questions;
    // return this.subsets.filter(({ isScoreIncluded }) => isScoreIncluded);
  }

  /**
   * Returns the models which are not scored
   * @todo Not actually a set - is this confusing?
   */
  get nonScoringSets() {
    return this.components.filter(model => !(this.scoringSets.includes(model)));
  }

  /**
   * @override
   */
  get minScore() {
    if (this.isComplete && !this.attempt?.isInSession) {
      return this.attempts.last.minScore;
    } else {
      return this.scoringSets.reduce((score, set) => score + set.minScore, 0);
    }
    // return 0;
  }

  /**
   * @override
   */
  get maxScore() {
    if (this.isComplete && !this.attempt?.isInSession) {
      return this.attempts.last.maxScore;
    } else {
      return this.scoringSets.reduce((score, set) => score + set.maxScore, 0);
    }
  }

  /**
   * @override
   */
  get score() {
    if (this.isComplete && !this.attempt?.isInSession) {
      return this.attempts.last.score;
    } else {
      return this.scoringSets.reduce((score, set) => score + set.score, 0);
    }
  }

  /**
   * Returns the number of correctly answered questions
   * @returns {Number}
   */
  get correctness() {
    if (this.isComplete && !this.attempt?.isInSession) {
      return this.attempts.last.correctness;
    } else {
      return this.questions.reduce((count, model) => count + (model.get('_isCorrect') ? 1 : 0), 0);
    }
  }

  /**
   * Returns the percentage of correctly answered questions
   * @note Assumes the same number of questions are used in each attempt
   * @returns {Number}
   */
  get scaledCorrectness() {
    return getScaledScoreFromMinMax(this.correctness, 0, this.questions.length);
  }

  /**
   * Returns the score of each populated subset
   * @returns {Object}
   */
  get scores() {
    const scores = {};
    this.scoringSets.forEach(set => (scores[set.id] = set.score));
    return scores;
  }

  /**
   * Returns the passmark model
   * @returns {Passmark}
   */
  get passmark() {
    return this._passmark;
  }

  /**
   * Returns the attempts model
   * @returns {Attempts}
   */
  get attempts() {
    return this._attempts;
  }

  /**
   * Returns the attempt model
   * @returns {Attempt}
   */
  get attempt() {
    return this._attempt;
  }

  /**
   * Returns the marking model
   * @returns {Marking}
   */
  get marking() {
    return this._marking;
  }

  /**
   * Returns the reset model
   * @returns {Reset}
   */
  get resetConfig() {
    return this._resetConfig;
  }

  /**
   * Returns whether the test can be reset
   * @returns {Boolean}
   */
  get canReset() {
    const config = this.isPassed ? this.resetConfig.passedConfig : this.resetConfig.failedConfig;
    return this.isComplete && this.attempts.hasRemaining && config._canReset && !this._hasReset;
  }

  /**
   * Returns whether the set should be reset when revisited
   * @returns {Boolean}
   */
  get shouldResetOnRevisit() {
    const config = this.isPassed ? this.resetConfig.passedConfig : this.resetConfig.failedConfig;
    return this.canReset && config._isResetOnRevisit;
  }

  /**
   * Returns whether the page can be reloaded
   * @todo use `Adapt.parentView` in calculation?
   * @returns {Boolean}
   */
  get canReload() {
    if (!this.resetConfig.reloadPage) return false;
    const pageId = this.model.findAncestor('pages')?.get('_id');
    const locationId = Adapt.location._currentId;
    return pageId === locationId;
  }

  /**
   * Returns whether all models have been completed in the last attempt
   * @returns {Boolean}
   */
  get isAttemptComplete() {
    if (!this.isAllModelsAdded) return false;
    return !(this.models.find(model => !model.get('_isInteractionComplete')));
  }

  /**
   * Returns whether the test is completed.
   * A previously completed "soft" reset test will be deemed completed.
   * When an attempt is currently in session, it will return the attempt completion for use in `ScoringSet.update`.
   * @override
   * @note If using banking the model completion cannot be used to check completion following a "soft" reset, as the models have changed - use a restored completion
   * @returns {Boolean}
   */
  get isComplete() {
    if (!this.isAllModelsAdded) return false;
    return this.attempt?.isInSession ? this.isAttemptComplete : this.attempts.history.some(attempt => attempt.isComplete);
    // return this.attempt.isInSession ? this.isAttemptComplete : this.model.get('_isComplete');
    // return this.isAttemptComplete || this.model.get('_isComplete');
  }

  /**
   * Returns whether the configured passmark has been achieved
   * @override
   * @todo As negative scores are not used in default `_score` of `QuestionModel`, should we allow passed before completion?
   * @todo Will passmark ever be disabled?
   * @returns {Boolean}
   */
  get isPassed() {
    // return false if not yet completed as the use of negative scores could mean answering incomplete questions lowers the score as you proceed
    if (!this.isComplete) return false;
    if (!this.attempt?.isInSession) return this.attempts.history.some(attempt => attempt.isPassed);

    if (this.passmark.isEnabled) {
      const isScaled = this.passmark.isScaled;
      const score = (isScaled) ? this.scaledScore : this.score;
      const correctness = (isScaled) ? this.scaledCorrectness : this.correctness;
      return score >= this.passmark.score && correctness >= this.passmark.correctness;
    } else {
      return false;
    }
  }

  /**
   * @todo Do we need all the values as in previous assessment? Do we even need a state as all these can be retrieved individually as required?
   */
  get state() {
    return {};
  }

  /**
   * Returns the state to save to offlineStorage
   * @todo component/block data required to restore which models were used across sessions when banking not used? Not needed for restoring correctness as before. Needed for role selectors?
   * @todo Have been cases where saving the scores etc was useful for amending issues with user data in xAPI.
   * @todo `score` and `correctness` needed if treating "soft" reset tests as completed. Could we use question attempts model for restoration instead - would only work if questions can't be reset in component view, so aligns with assessment attempts?
   * @todo Need `minScore` and `maxScore` if using banking?
   * @returns {Array}
   */
  get saveState() {
    return [
      this.attempts.saveState,
      this.attempt.saveState
    ];
  }

  /**
   * Returns the state name for offlineStorage
   * @todo Is 'a' an appropriate name? Reduces size but could lead to conflicts.
   * @returns {String}
   */
  get saveStateName() {
    return 'a';
  }

  /**
   * @private
   * @todo Move to `TestsSet`?
   */
  _saveState() {
    const data = OfflineStorage.get(this.saveStateName) ?? {};
    data[this.id] = OfflineStorage.serialize(this.saveState);
    OfflineStorage.set(this.saveStateName, data);
  }

  /**
   * @private
   */
  _refreshQuestions() {
    this.questions.forEach(model => model.refresh());
  }

  /**
   * @param {Object} location
   * @listens Adapt#router:location
   */
  async onRouterLocation(location) {
    if (this.attempt) this.attempt.isInSession = false;
    if (location._contentType !== 'page') return;
    const model = location._currentModel;
    if (!(Adapt.tests.getModelHasTest(model))) return;
    if (this.shouldResetOnRevisit) await this.reset();
    this._hasReset = false;

    if (!this.isAttemptComplete) {
      this.attempt.start();
      this._saveState();
    }

    // @todo: fire event for when assessment is to be rendered?
    // Adapt.trigger('assessment:preRender', this);
  }

  /**
   * @override
   * @fires Adapt#assessment:complete
   * @property {TestSet}
   */
  onCompleted() {
    if (this.attempt.isInProgress) {
      this.attempt.end();
      this.attempts.spend();
      this.attempts.record(this.attempt);
      this._saveState();
    }

    // @todo: do we need a defer here as before?
    if (this.marking.isEnabled && this.marking.isSuppressed && !this.attempts.hasRemaining) {
      this._initQuestions();
      this._refreshQuestions();
    }

    // @todo: do we need to send state when it can just be retrieved from assessment anyway?
    Adapt.trigger('assessment:complete', this);
    // Adapt.trigger('assessments:complete', this.getState(), this);
    Logging.debug(`${this.id} assessment completed`);
  }

  /**
   * @override
   * @fires Adapt#assessment:pass
   * @property {TestSet}
   */
  onPassed() {
    Adapt.trigger('assessment:pass', this);
    Logging.debug(`${this.id} assessment passed`);
  }

}
