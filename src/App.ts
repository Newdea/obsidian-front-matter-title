import ResolverInterface, {Resolving} from "@src/Interfaces/ResolverInterface";
import Container from "@config/inversify.config";
import DispatcherInterface from "@src/EventDispatcher/Interfaces/DispatcherInterface";
import {SettingsEvent} from "@src/Settings/SettingsType";
import ObjectHelper from "@src/Utils/ObjectHelper";
import CallbackVoid from "@src/EventDispatcher/CallbackVoid";
import SI from "@config/inversify.types";
import {ResolverEvents} from "@src/Resolver/ResolverType";
import BlackWhiteListInterface from "@src/Components/BlackWhiteList/BlackWhiteListInterface";
import Event from "@src/EventDispatcher/Event";
import Storage from "@src/Settings/Storage";

export default class App {
    private container = Container;
    private resolvers: {
        [Resolving.Sync]?: ResolverInterface
        [Resolving.Async]?: ResolverInterface<Resolving.Async>
    } = {};

    constructor() {
        this.processResolvers();
    }

    private getStorage(): Storage<SettingsEvent> {
        return this.container.get<Storage<SettingsEvent>>(SI.storage);
    }

    private processResolvers(): void {
        this.resolvers[Resolving.Sync] = this.container.getNamed(SI.resolver, Resolving.Sync);
    }


    private bind(): void {
        const dispatcher: DispatcherInterface<SettingsEvent> = this.container.get(SI.dispatcher);
        dispatcher.addListener('settings.changed', new CallbackVoid<SettingsEvent['settings.changed']>(e => this.onSettingsChanged(e.get())))
    }

    private onSettingsChanged({old, actual}: SettingsEvent['settings.changed']): void {
        const changed = ObjectHelper.compare(old, actual);
        type events = ResolverEvents;
        const queue: { [K in keyof events]?: events[K] } = {};
        if (changed.path) {
            this.container.rebind(SI.template).toConstantValue(actual.path);
            this.processResolvers();
        }
        if (changed?.rules?.paths) {
            const list = this.container.get<BlackWhiteListInterface>(SI['component.black_white_list']);
            if (changed.rules.paths?.mode) {
                list.setMode(actual.rules.paths.mode);
            }
            if (changed.rules.paths.values) {
                list.setList(actual.rules.paths.values);
            }
            queue['resolver.clear'] = {all: true};
        }

        const dispatcher = this.container.get<DispatcherInterface<events>>(SI.dispatcher);
        for (const event of Object.keys(queue) as (keyof events)[]) {
            dispatcher.dispatch(event, new Event(queue[event]));
        }
    }

    public getResolver<T extends Resolving>(type: T): ResolverInterface<T> {
        return this.resolvers[type] as ResolverInterface<T>;
    }
}