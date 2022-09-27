import Adapt from 'core/js/adapt';
import data from 'core/js/data';
import TestSet from './TestSet';
import TestsSet from './TestsSet';

class Test extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, 'app:dataReady', this.onAppDataReady);
  }

  onAppDataReady() {
    const {
      _isBackwardCompatible = true
    } = (Adapt.course.get('_tests') || { _isBackwardCompatible: true });
    Adapt.tests = new TestsSet({ _isBackwardCompatible });
    const testModels = data.filter(model => model.get('_test')?._isEnabled);
    testModels.forEach(model => new TestSet({ model, _isBackwardCompatible }));
  }

}

export default new Test();
