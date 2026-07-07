package com.jhotadhari.reactnative.mapsforge.vtm.ext.pathcolorramp;

import androidx.annotation.NonNull;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.uimanager.ViewManager;
import com.jhotadhari.reactnative.mapsforge.vtm.ext.pathcolorramp.modules.LayerPathColorRamp;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// "implements ReactPackage" is redundant (BaseReactPackage already implements it) but required
// for the react-native CLI's autolinking regex to detect this as the module's package class.
public class MapsforgeVtmExtPathColorRampPackage extends BaseReactPackage implements ReactPackage {

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return new ArrayList<>();
    }

    @Override
    public NativeModule getModule(@NonNull String s, @NonNull ReactApplicationContext reactApplicationContext) {
        if (LayerPathColorRamp.NAME.equals(s)) {
            return new LayerPathColorRamp(reactApplicationContext);
        }
        return null;
    }

    @NonNull
    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return new ReactModuleInfoProvider() {
            @NonNull
            @Override
            public Map<String, ReactModuleInfo> getReactModuleInfos() {
                Map<String, ReactModuleInfo> map = new HashMap<>();
                map.put(LayerPathColorRamp.NAME, new ReactModuleInfo(
                    LayerPathColorRamp.NAME,
                    LayerPathColorRamp.NAME,
                    false,
                    false,
                    false,
                    true
                ));
                return map;
            }
        };
    }
}
