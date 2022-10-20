import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import Passmark from './Passmark';
import ScoringSet from 'extensions/adapt-contrib-scoring/js/ScoringSet';
import {
  hasIntersectingHierarchy,
  getSubsetsByType,
  getSubsetsByModelId,
  getScaledScoreFromMinMax
} from 'extensions/adapt-contrib-scoring/js/adapt-contrib-scoring';

const defaultConfig = {
  _passmark: {
    _isEnabled: true,
    _requirePassedSubsets: true,
    _score: 75,
    _correctness: 50,
    _isScaled: true
  },
  _isBackwardCompatible: true
};

export default class TestsSet extends ScoringSet {

  initialize(options = {}, subsetParent = null) {
    this._isBackwardCompatible = options._isBackwardCompatible ?? true;
    this._config = Adapt.course.get('_tests') ?? defaultConfig;
    this._passmark = new Passmark(this._config._passmark);
    if (!subsetParent) {
      this._setupBackwardsCompatility();
    }
    super.initialize({
      ...options,
      _id: 'tests',
      _type: 'tests',
      _isContainer: true
    }, subsetParent);
  }

  _setupBackwardsCompatility() {
    if (!this._isBackwardCompatible) return;
    Adapt.assessment = {
      get: id => {
        const set = this.getById(id) || this.getByModelId(id)[0];
        return set?.model;
      },
      getState: () => {
        return this._compatibilityState;
      }
    };
  }

  get _compatibilityState() {
    const state = {
      isComplete: this.isComplete,
      isPercentageBased: this.passmark.isScaled,
      isPass: this.isPassed,
      maxScore: this.maxScore,
      minScore: this.minScore,
      score: this.score,
      scoreToPass: this.passmark.score,
      scoreAsPercent: this.scaledScore,
      correctCount: this.correctness,
      correctAsPercent: this.scaledCorrectness,
      correctToPass: this.passmark.correctness,
      questionCount: this.questions.length,
      assessmentsComplete: this.subsets.reduce((count, testSet) => (count += testSet.isComplete ? 1 : 0), 0),
      assessments: this.subsets.length,
      canRetry: this.canRetry
    };
    return state;
  }

  /**
   * @override
   */
  restore() {
    if (this._isBackwardCompatible) Adapt.trigger('assessment:restored', this._compatibilityState);
    Adapt.trigger('tests:restored', this);
  }

  /**
   * @override
   */
  update() {
    Logging.debug(`${this.id} minScore: ${this.minScore}, maxScore: ${this.maxScore}`);
    Logging.debug(`${this.id} score: ${this.score}, scaledScore: ${this.scaledScore}`);
    Logging.debug(`${this.id} isComplete: ${this.isComplete}, isPassed: ${this.isPassed}`);
    super.update();
  }

  /**
   * Reset all subsets
   */
  reset() {
    this.subsets.forEach(set => set.reset());
    Adapt.trigger('tests:reset', this);
  }

  /**
   * Returns whether a specified model is included within this set
   * @param {Backbone.Model} model
   * @returns {boolean}
   */
  getModelHasTest(model) {
    return hasIntersectingHierarchy([model], this.models);
  }

  /**
   * Returns an test associated with a specified model id
   * @param {string} id
   * @returns {Array<TestSet>}
   */
  getByModelId(id) {
    return getSubsetsByModelId(id).filter(set => set.type === 'test');
  }

  /**
   * Returns the test with the specified id
   * @param {string} id
   * @returns {TestSet}
   */
  getById(id) {
    return this.subsets.find(set => set.id === id);
  }

  /**
   * @override
   * Returns all unique test models for all or a subset of intersecting tests
   * @returns {[Backbone.Model]}
   */
  get models() {
    const models = this.subsets.reduce((models, set) => {
      const items = set.models;
      if (!items) return models;
      return models.concat(items);
    }, []);
    return this.filterModels(models);
  }

  /**
   * Returns all test subsets
   * @returns {[TestSet]}
   */
  get subsets() {
    return getSubsetsByType('test');
  }

  /**
   * Returns whether all models have been added
   * @returns {boolean}
   */
  get isAwaitingChildren() {
    return this.subsets.find(set => set.isAwaitingChildren);
  }

  /**
   * @override
   */
  get minScore() {
    return this.subsets.reduce((score, set) => score + set.miScore, 0);
  }

  /**
   * @override
   */
  get maxScore() {
    return this.subsets.reduce((score, set) => score + set.maxScore, 0);
  }

  /**
   * @override
   */
  get score() {
    return this.subsets.reduce((score, set) => score + set.score, 0);
  }

  /**
   * Returns the number of correctly answered questions
   * @returns {number}
   */
  get correctness() {
    return this.subsets.reduce((count, set) => count + set.correctness, 0);
  }

  /**
   * Returns the percentage of correctly answered questions
   * @returns {number}
   */
  get scaledCorrectness() {
    const questionCount = this.subsets.reduce((count, set) => count + set.questions.length, 0);
    return getScaledScoreFromMinMax(this.correctness, 0, questionCount);
  }

  /**
   * Returns the passmark model
   * @returns {Passmark}
   */
  get passmark() {
    return this._passmark;
  }

  /**
   * Returns whether any TestModel can be reset
   * @returns {boolean}
   */
  get canReset() {
    return this.subsets.some(model => model.canReset);
  }

  /**
   * Returns whether any TestModel is failed and can be retried
   * @returns {boolean}
   */
  get canRetry() {
    return this.subsets.some(model => model.canRetry);
  }

  /**
   * Returns whether all subsets have been completed
   * If _passmark._requirePassedSubsets then all subsets have to be passed
   * @override
   * @returns {boolean}
   */
  get isComplete() {
    return this.subsets.every(set => set.isComplete && (!this.passmark.requiresPassedSubsets || set.isPassed));
  }

  /**
   * Returns whether all subsets have been completed
   * @returns {boolean}
   */
  get isPassed() {
    return this.subsets.every(set => set.isPassed);
  }

  /**
   * @override
   * @fires Adapt#assessments:complete
   * @property {AssessmentsSet}
   */
  onCompleted() {
    if (this._isBackwardCompatible) Adapt.trigger('assessment:complete', this._compatibilityState);
    Adapt.trigger('tests:complete', this);
  }

  /**
   * @override
   * @fires Adapt#assessments:pass
   * @property {AssessmentsSet}
   */
  onPassed() {
    Adapt.trigger('tests:pass', this);
    Logging.debug('tests passed');
  }

}
