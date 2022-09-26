import Adapt from 'core/js/adapt';
import Data from 'core/js/data';
import TestSet from './TestSet';
import TestsSet from './TestsSet';

class Test extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'app:dataReady': this.onAppDataReady
    });
  }

  hasTest(model) {
    return this.getConfigByModel(model)?._isEnabled;
  }

  getConfigByModel(model) {
    return model.get('_test');
  }

  get testModels() {
    return Data.filter(model => this.hasTest(model));
  }

  onAppDataReady() {
    Adapt.tests = new TestsSet();
    this.testModels.forEach(model => new TestSet({ model }));
  }

}

export default new Test();
