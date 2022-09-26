import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import ScoringSet from 'extensions/adapt-contrib-scoring/js/ScoringSet';
import Passmark from './Passmark';
import {
  hasIntersectingHierarchy,
  getSubsetsByType,
  getSubsetsByModelId,
  getScaledScoreFromMinMax
} from 'extensions/adapt-contrib-scoring/js/scoring';

export default class TestsSet extends ScoringSet {

  initialize(options = {}, subsetParent = null) {
    this._initConfig();

    super.initialize({
      ...options,
      _id: 'tests',
      _type: 'tests'
    }, subsetParent);
  }

  /**
   * @private
   * @todo `_tests` rather than `assessment`
   */
  _initConfig() {
    this._config = Adapt.course.get('_tests');
    this._passmark = new Passmark(this._config._passmark);
  }

  /**
   * @override
   */
  restore() {
    // @todo: previously `assessment:restored` so need to check which plugins use this
    Adapt.trigger('assessments:restored', this);
    // Adapt.trigger('assessments:restored', this.state, this);
  }

  /**
   * @extends
   */
  update() {
    Logging.debug(`${this.id} minScore: ${this.minScore}, maxScore: ${this.maxScore}`);
    // Logging.debug(`${this.id} scores: ${JSON.stringify(this.scores)}`);
    Logging.debug(`${this.id} score: ${this.score}, scaledScore: ${this.scaledScore}`);
    Logging.debug(`${this.id} isComplete: ${this.isComplete}, isPassed: ${this.isPassed}`);
    super.update();
  }

  /**
   * Reset all subsets
   * @todo Trigger an event to say all tests have been reset?
   */
  reset() {
    this.subsets.forEach(set => set.reset());
    // Adapt.trigger('assessments:reset', this);
  }

  /**
   * Returns whether a specified model is included within this set
   * @param {Backbone.Model} model
   * @returns {Boolean}
   */
  getModelHasTest(model) {
    return hasIntersectingHierarchy([model], this.models);
    // return this.subsets.find(set => set.model === model);
  }

  /**
   * Returns an test associated with a specified model id
   * @todo If more than one associated test it will return the first found
   * @param {String} id
   * @returns {TestSet}
   */
  getByModelId(id) {
    return getSubsetsByModelId(id).find(set => set.type === 'test');
  }

  /**
   * Returns the test with the specified id
   * @param {String} id
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
   * @returns {Boolean}
   */
  get isAllModelsAdded() {
    return this.subsets.find(set => !set.isAllModelsAdded);
  }

  /**
   * Returns all `_isAvailable` component models
   * @todo '_isAvailable' isn't inherited so unavailable blocks won't mean unavailable children and vice versa
   * @returns {[ComponentModel]}
   */
  get components() {
    return this.subsets.reduce((models, set) => models.concat(set.components), []);
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
   * @todo Return questions so scoringSets can always be used in queries?
   * @todo If using buckets it isn't limited to questions
   * @todo Not actually a set - is this confusing?
   * @override
   * @borrows questions as scoringSets
   * @returns {[QuestionModel]}
   */
  get scoringSets() {
    return this.subsets.reduce((models, set) => models.concat(set.scoringSets), []);
  }

  /**
   * @todo Not actually a set - is this confusing?
   */
  get nonScoringSets() {
    return this.subsets.reduce((models, set) => models.concat(set.nonScoringSets), []);
  }

  /**
   * @override
   */
  get minScore() {
    return 0;
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
   * @returns {Number}
   */
  get correctness() {
    return this.subsets.reduce((count, set) => count + set.correctness, 0);
  }

  /**
   * Returns the percentage of correctly answered questions
   * @returns {Number}
   */
  get scaledCorrectness() {
    const questionCount = this.subsets.reduce((count, set) => count + set.questions.length, 0);
    return getScaledScoreFromMinMax(this.correctness, 0, questionCount);
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
   * Returns whether the test can be reset
   * @returns {Boolean}
   */
  get canReset() {
    const config = this.isPassed ? this.resetConfig.passedConfig : this.resetConfig.failedConfig;
    return this.isComplete && this.attempts.hasRemaining && config._canReset;
  }

  /**
   * Returns whether all subsets have been completed
   * @override
   * @returns {Boolean}
   */
  get isComplete() {
    return !(this.subsets.find(set => !set.isComplete));
  }

  /**
   * Returns whether all subsets have been completed
   * @returns {Boolean}
   */
  get isPassed() {
    return !(this.subsets.find(set => !set.isPassed));
  }

  /**
   * @override
   * @fires Adapt#assessments:complete
   * @property {AssessmentsSet}
   */
  onCompleted() {
    Adapt.trigger('assessments:complete', this);
  }

  /**
   * @override
   * @fires Adapt#assessments:pass
   * @property {AssessmentsSet}
   */
  onPassed() {
    Adapt.trigger('assessments:pass', this);
    Logging.debug('assessments passed');
  }

}
