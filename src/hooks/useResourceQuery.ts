import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

import type { ListParams, Paginated } from '../types/api'

type UpdateVariables<TInput> = {
  id: number
  payload: Partial<TInput>
}

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  'mutationFn' | 'onSuccess'
> & {
  onSuccess?: UseMutationOptions<TData, Error, TVariables>['onSuccess']
}

export function useList<T>(
  key: QueryKey,
  fetcher: (params?: ListParams) => Promise<Paginated<T>>,
  params?: ListParams,
  options?: Omit<UseQueryOptions<Paginated<T>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Paginated<T>, Error>({
    queryKey: [...key, params ?? {}],
    queryFn: () => fetcher(params),
    ...options,
  })
}

export function useDetail<T>(
  key: QueryKey,
  id: number | null | undefined,
  fetcher: (id: number) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  return useQuery<T, Error>({
    queryKey: [...key, id],
    queryFn: () => fetcher(id as number),
    enabled: id !== null && id !== undefined,
    ...options,
  })
}

export function useCreateMutation<TRead, TInput>(
  listKey: QueryKey,
  creator: (payload: TInput) => Promise<TRead>,
  options?: MutationOptions<TRead, TInput>,
) {
  const queryClient = useQueryClient()

  return useMutation<TRead, Error, TInput>({
    mutationFn: creator,
    ...options,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: listKey })
      await options?.onSuccess?.(data, variables, context)
    },
  })
}

export function useUpdateMutation<TRead, TInput>(
  listKey: QueryKey,
  updater: (id: number, payload: Partial<TInput>) => Promise<TRead>,
  options?: MutationOptions<TRead, UpdateVariables<TInput>>,
) {
  const queryClient = useQueryClient()

  return useMutation<TRead, Error, UpdateVariables<TInput>>({
    mutationFn: ({ id, payload }) => updater(id, payload),
    ...options,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: listKey })
      await options?.onSuccess?.(data, variables, context)
    },
  })
}

export function useDeleteMutation(
  listKey: QueryKey,
  remover: (id: number) => Promise<void>,
  options?: MutationOptions<void, number>,
) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, number>({
    mutationFn: remover,
    ...options,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: listKey })
      await options?.onSuccess?.(data, variables, context)
    },
  })
}

export function useActionMutation<TRead, TVariables>(
  listKey: QueryKey,
  action: (variables: TVariables) => Promise<TRead>,
  options?: MutationOptions<TRead, TVariables>,
) {
  const queryClient = useQueryClient()

  return useMutation<TRead, Error, TVariables>({
    mutationFn: action,
    ...options,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: listKey })
      await options?.onSuccess?.(data, variables, context)
    },
  })
}
