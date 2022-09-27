import Adapt from 'core/js/adapt';
import router from 'core/js/router';
import location from 'core/js/location';
import Logging from 'core/js/logging';
import OfflineStorage from 'core/js/offlineStorage';
import Passmark from './Passmark';
import Attempts from './Attempts';
import Attempt from './Attempt';
import Marking from './Marking';
import Reset from './Reset';
import ScoringSet from 'extensions/adapt-contrib-scoring/js/ScoringSet';
import {
  getScaledScoreFromMinMax
} from 'extensions/adapt-contrib-scoring/js/adapt-contrib-scoring';
import _ from 'underscore';

const saveStateName = 'as';

export default class TestSet extends ScoringSet {

  initialize(options = {}, subsetParent = null) {
    this._isBackwardCompatible = options._isBackwardCompatible ?? true;
    this._model = options.model;
    this._config = this.model.get('_test');
    this._resetConfig = new Reset(this._config._reset);
    this._passmark = new Passmark(this._config._passmark);
    this._marking = new Marking(this._config?._questions?._canShowMarking, this._config?._suppressMarking);
    this._attempt = new Attempt(this);
    this._attempts = new Attempts(this._config._attempts, this);
    this._hasReset = false;
    this._overrideQuestionConfiguration();
    this._setupBackwardsCompatility();
    super.initialize({
      ...options,
      _id: this._config._id,
      title: this._config.title,
      _type: 'test'
    }, subsetParent);
  }

  _setupBackwardsCompatility() {
    if (!this._isBackwardCompatible) return;
    this.model.getState = () => this._compatibilityState;
    this.model.canResetInPage = () => this.canReset && this.canReload;
    const originalReset = this.model.reset;
    this.model.reset = (force, done) => {
      if (force === false) return;
      this.reset().then(() => {
        typeof done === 'function' && done(true);
        originalReset.call(this.model, force);
      });
    };
    const assessmentMock = {};
    Object.defineProperty(assessmentMock, '_isResetOnRevisit', {
      get: () => {
        // Allow this value to change, providing compatibility for assessmentResults
        return this.isPassed
          ? this.resetConfig.passedConfig._isResetOnRevisit
          : this.resetConfig.failedConfig._isResetOnRevisit;
      }
    });
    this.model.set('_assessment', assessmentMock);
  }

  get _compatibilityState() {
    const state = {
      id: this.config._id,
      type: 'article-assessment',
      pageId: this.model.getParent().get('_id'),
      articleId: this.model.get('_id'),
      isEnabled: this.config._isEnabled,
      isComplete: this.isComplete,
      isPercentageBased: this.passmark.isScaled,
      scoreToPass: this.passmark.score,
      score: this.score,
      scoreAsPercent: this.scaledScore,
      maxScore: this.minScore,
      minScore: this.maxScore,
      correctCount: this.correctness,
      correctAsPercent: this.scaledCorrectness,
      correctToPass: this.passmark.correctness,
      questionCount: this.models.length,
      isPass: this.isPassed,
      includeInTotalScore: this.config._isScoreIncluded,
      assessmentWeight: 1,
      attempts: this.attempts.isInfinite ? 'infinite' : this.attempts.limit,
      attemptsSpent: this.attempts.used,
      attemptsLeft: this.attempts.isInfinite ? 'infinite' : this.attempts.remaining,
      attemptInProgress: false,
      lastAttemptScoreAsPercent: null,
      questions: this.questions.map(model => ({ _id: model.get('_id'), _isCorrect: model.get('_isCorrect') })),
      resetType: this.resetConfig.scoringType,
      allowResetIfPassed: this.resetConfig.passedConfig._canReset,
      questionModels: new Backbone.Collection(this.questions)
    };
    return state;
  }

  /**
   * @override
   */
  register() {
    if (this._isBackwardCompatible) Adapt.trigger('assessments:register', this._compatibilityState, this.model);
    super.register(this);
  }

  /**
   * @private
   * @todo Add option to `_suppressFeedback` so user can review once completed and no attempts remaining?
   */
  _overrideQuestionConfiguration() {
    const isMarkingEnabled = this.marking.isEnabled && !(this.marking.isSuppressed && this.attempts.hasRemaining);
    this.questions.forEach(model => {
      model.set({
        _canShowFeedback: this._config?._questions?._canShowFeedback ?? false,
        _canShowMarking: isMarkingEnabled,
        _canShowModelAnswer: isMarkingEnabled && (this._config?._questions?._canShowModelAnswer ?? false),
        _isPartOfAssessment: true
      }, { pluginName: 'tests' });
    });
  }

  /**
   * @override
   */
  _setupListeners() {
    super._setupListeners();
    this.listenTo(Adapt, 'router:location', this.onRouterLocation);
  }

  /**
   * @override
   */
  restore() {
    const storedData = OfflineStorage.get(saveStateName)?.[this.id];
    if (storedData) {
      const data = OfflineStorage.deserialize(storedData);
      this.attempts.restore(data[0]);
      this.attempt.restore(data[1]);
    }
    if (this._isBackwardCompatible) Adapt.trigger('assessments:restored', this._compatibilityState, this.model);
    Adapt.trigger('test:restored', this);
  }

  /**
   * @override
   */
  update() {
    Logging.debug(`${this.id} minScore: ${this.minScore}, maxScore: ${this.maxScore}`);
    Logging.debug(`${this.id} score: ${this.score}, scaledScore: ${this.scaledScore}`);
    Logging.debug(`${this.id} isAttemptComplete: ${this.isAttemptComplete}, isComplete: ${this.isComplete}, isPassed: ${this.isPassed}`);
    if (this.attempt) this.attempt.updateScore();
    super.update();
    if (Adapt.get('_isStarted')) this.save();
  }

  /**
   * Reset all models
   * @todo Should reset if this.model is reset
   * @todo Doesn't complete properly if scrolled to without reload
   * @returns {Promise}
   */
  async reset() {
    if (this._isBackwardCompatible) Adapt.trigger('assessments:preReset', this._compatibilityState, this.model);
    Adapt.trigger('test:preReset', this);
    this.questions.forEach(model => model.reset(this.resetConfig._questionsType, true));
    this.presentationComponents.forEach(model => model.reset(this.resetConfig._presentationComponentsType, true));
    this._attempt = new Attempt(this);
    this._hasReset = true;
    await Adapt.deferUntilCompletionChecked();
    if (this._isBackwardCompatible) Adapt.trigger('assessments:reset', this._compatibilityState, this.model);
    Adapt.trigger('test:reset', this);
    if (this.canReload) {
      this.reload();
    } else if (this.resetConfig._scrollTo) {
      this.attempt.start();
      router.navigateToElement(this.model.get('_id'));
    }
    _.defer(() => {
      if (this._isBackwardCompatible) Adapt.trigger('assessments:postReset', this._compatibilityState, this.model);
      Adapt.trigger('test:postReset', this);
    });
  }

  /**
   * Reload the page and scroll to assessment if configured
   */
  reload() {
    const id = this.resetConfig._scrollTo ? this.model.get('_id') : location._currentId;
    router.navigate(`#/id/${id}`, { replace: true, trigger: true });
  }

  get config() {
    return this._config;
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
   * @returns {boolean}
   */
  get isAwaitingChildren() {
    return this.model.get('_requireCompletionOf') === Number.POSITIVE_INFINITY;
  }

  /**
   * @override
   */
  get minScore() {
    if (this.isComplete && !this.attempt?.isInSession) return this.attempts.minScore;
    return this.questions.reduce((score, set) => score + set.minScore, 0);
  }

  /**
   * @override
   */
  get maxScore() {
    if (this.isComplete && !this.attempt?.isInSession) return this.attempts.maxScore;
    return this.questions.reduce((score, set) => score + set.maxScore, 0);
  }

  /**
   * @override
   */
  get score() {
    if (this.isComplete && !this.attempt?.isInSession) return this.attempts.score;
    return this.questions.reduce((score, set) => score + set.score, 0);
  }

  /**
   * Returns the number of correctly answered questions
   * @returns {number}
   */
  get correctness() {
    if (this.isComplete && !this.attempt?.isInSession) return this.attempts.correctness;
    return this.questions.reduce((count, model) => count + (model.get('_isCorrect') ? 1 : 0), 0);
  }

  /**
   * Returns the percentage of correctly answered questions
   * @note Assumes the same number of questions are used in each attempt
   * @returns {number}
   */
  get scaledCorrectness() {
    return getScaledScoreFromMinMax(this.correctness, 0, this.questions.length);
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
   * @returns {boolean}
   */
  get canReset() {
    const config = this.isPassed ? this.resetConfig.passedConfig : this.resetConfig.failedConfig;
    return this.isComplete && this.attempts.hasRemaining && config._canReset && !this._hasReset;
  }

  get canRetry() {
    const isFailed = !this.isPassed;
    const hasAttemptsLeft = (this.attempts.remaining > 0 || this.attempts.remaining === 'infinite');
    return (isFailed && hasAttemptsLeft);
  }

  /**
   * Returns whether the set should be reset when revisited
   * @returns {boolean}
   */
  get shouldResetOnRevisit() {
    const config = this.isPassed
      ? this.resetConfig.passedConfig
      : this.resetConfig.failedConfig;
    return this.canReset && config._isResetOnRevisit;
  }

  /**
   * Returns whether the page can be reloaded
   * @returns {boolean}
   */
  get canReload() {
    if (!this.resetConfig.reloadPage) return false;
    const pageId = this.model.findAncestor('page')?.get('_id');
    const locationId = location._currentId;
    return (pageId === locationId);
  }

  /**
   * Returns whether all models have been completed in the last attempt
   * @returns {boolean}
   */
  get isAttemptComplete() {
    if (this.isAwaitingChildren) return false;
    return this.models.every(model => model.get('_isInteractionComplete'));
  }

  /**
   * Returns whether the test is completed.
   * A previously completed "soft" reset test will be deemed completed.
   * When an attempt is currently in session, it will return the attempt completion for use in `ScoringSet.update`.
   * @override
   * @note If using banking the model completion cannot be used to check completion following a "soft" reset, as the models have changed - use a restored completion
   * @returns {boolean}
   */
  get isComplete() {
    if (this.isAwaitingChildren) return false;
    return this.attempt?.isInSession
      ? this.isAttemptComplete
      : this.attempts.wasComplete;
  }

  /**
   * Returns whether the configured passmark has been achieved
   * @override
   * @returns {boolean}
   */
  get isPassed() {
    if (this.attempt?._isInProgress && !this.isComplete) return false; // Must be completed for a pass
    if (!this.passmark.isEnabled && this.isComplete) return true; // Always pass if complete and passmark is disabled
    if (!this.attempt?._isInProgress) return this.attempts.wasPassed;
    const isScaled = this.passmark.isScaled;
    const score = (isScaled) ? this.scaledScore : this.score;
    const correctness = (isScaled) ? this.scaledCorrectness : this.correctness;
    const isPassed = score >= this.passmark.score && correctness >= this.passmark.correctness;
    return isPassed;
  }

  get saveState() {
    return [
      this.attempts.saveState,
      this.attempt.saveState
    ];
  }

  save() {
    /**
     * @todo component/block data required to restore which models were used across sessions when banking not used? Not needed for restoring correctness as before. Needed for role selectors?
     * @todo Have been cases where saving the scores etc was useful for amending issues with user data in xAPI.
     * @todo `score` and `correctness` needed if treating "soft" reset tests as completed. Could we use question attempts model for restoration instead - would only work if questions can't be reset in component view, so aligns with assessment attempts?
     * @todo Need `minScore` and `maxScore` if using banking?
     */
    const data = OfflineStorage.get(saveStateName) ?? {};
    data[this.id] = OfflineStorage.serialize(this.saveState);
    OfflineStorage.set(saveStateName, data);
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
      this.save();
    }
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
      this.save();
    }
    /**
     * @todo: do we need a defer here as before?
     */
    if (this.marking.isEnabled && this.marking.isSuppressed && !this.attempts.hasRemaining) {
      this._overrideQuestionConfiguration();
      this.questions.forEach(model => model.refresh());
    }
    if (this._isBackwardCompatible) Adapt.trigger('assessments:complete', this._compatibilityState, this.model);
    Adapt.trigger('test:complete', this);
    Logging.debug(`${this.id} test completed`);
  }

  /**
   * @override
   * @fires Adapt#assessment:pass
   * @property {TestSet}
   */
  onPassed() {
    Adapt.trigger('test:pass', this);
    Logging.debug(`${this.id} test passed`);
  }

}
