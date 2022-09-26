export default class Reset {

  constructor(config = {}) {
    this._reloadPage = config._reloadPage ?? true;
    this._scrollTo = config._scrollTo ?? true;
    this._scoringType = config._scoringType ?? 'hard';
    this._nonScoringType = config._nonScoringType ?? 'soft';

    this._failedConfig = Object.assign({
      _isResetOnRevisit: true,
      _canReset: true
    }, config?._failed);

    this._passedConfig = Object.assign({
      _isResetOnRevisit: true,
      _canReset: true
    }, config?._passed);
  }

  /**
   * Returns whether to reload the page on reset
   * @returns {Boolean}
   */
  get reloadPage() {
    return this._reloadPage;
  }

  /**
   * Returns whether to scroll to the test on reset
   * @returns {Boolean}
   */
  get scrollTo() {
    return this._scrollTo;
  }

  /**
   * Returns the reset type for scoring models
   * @returns {String}
   */
  get scoringType() {
    return this._scoringType;
  }

  /**
   * Returns the reset type for non-scoring models
   * @returns {String}
   */
  get nonScoringType() {
    return this._nonScoringType;
  }

  /**
   * Returns the failed config
   * @returns {Object}
   */
  get failedConfig() {
    return this._failedConfig;
  }

  /**
   * Returns the passed config
   * @returns {Object}
   */
  get passedConfig() {
    return this._passedConfig;
  }

}
